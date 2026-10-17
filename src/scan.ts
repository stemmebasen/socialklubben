import type { D1Database } from "./db.js";
import type { Deps, Env } from "./env.js";
import { contentHash, plain, webUrl, zonedMs } from "./feed.js";
import { addressFor, isOnline, venueFor } from "./geocode.js";
import { extractPriceMinor } from "./price.js";
import { claimJob, readLimited, WINDOW_DAYS, type Source } from "./sources.js";
import { topicFor } from "./topics.js";

/** The scanner: it finds events the portal does not have yet, so the administration can decide on them.
 * It reads the web pages the administration has listed once a week - the schema.org event data many
 * event pages carry for search engines, and any calendar address on the page - and it takes visitors'
 * tips. Nothing it finds is shown before it is approved, and nothing is guessed: a field the page does
 * not state stays empty. A site that asks robots not to read a page (robots.txt) is not read. */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const ZONE = "Europe/Copenhagen";
const MAX_PAGE_BYTES = 2_000_000;
const SITES_PER_RUN = 5;
const RESCAN_DAYS = 7;
export const USER_AGENT = "Eventportal-scanner (læser offentlige eventsider en gang om ugen)";

export type Found = {
  title: string; startsAtMs: number; endsAtMs: number | null; allDay: boolean; location: string | null; description: string | null;
  link: string | null; imageUrl: string | null; organizer: string | null; priceMinor: number | null;
};

// ---- Reading a page ----

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
const text = (value: Json | undefined): string | null => {
  if (typeof value === "string") return plain(value).slice(0, 4000) || null;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return text(value[0]);
  return null;
};
const types = (node: { [key: string]: Json }) => ([] as Json[]).concat(node["@type"] ?? []).filter((t): t is string => typeof t === "string");
const isEvent = (node: { [key: string]: Json }) => types(node).some(t => /Event$|^Festival$/.test(t) && t !== "PublicationEvent");

/** "2026-10-20T19:00:00+02:00" as it says; "2026-10-20T19:00" in Copenhagen time; "2026-10-20" is all day. */
export function eventTime(value: string | null): { ms: number; allDay: boolean } | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s, zone] = m;
  if (h === undefined) return { ms: zonedMs(+y!, +mo!, +d!, 0, 0, 0, ZONE), allDay: true };
  if (zone) {
    const ms = Date.parse(`${y}-${mo}-${d}T${h}:${mi}:${s ?? "00"}${zone === "Z" ? "Z" : zone.replace(/^([+-]\d{2})(\d{2})$/, "$1:$2")}`);
    return Number.isFinite(ms) ? { ms, allDay: false } : null;
  }
  return { ms: zonedMs(+y!, +mo!, +d!, +h!, +mi!, +(s ?? 0), ZONE), allDay: false };
}

function place(value: Json | undefined): string | null {
  if (typeof value === "string") return text(value);
  if (Array.isArray(value)) return place(value[0]);
  if (!value || typeof value !== "object") return null;
  if (types(value).includes("VirtualLocation")) return "Online";
  const address = value.address;
  const street = typeof address === "string" ? text(address)
    : address && typeof address === "object" && !Array.isArray(address)
      ? [text(address.streetAddress), [text(address.postalCode), text(address.addressLocality)].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null : null;
  const name = text(value.name);
  return name && street && !street.includes(name) ? `${name}, ${street}` : street ?? name;
}

function price(offers: Json | undefined): number | null {
  const offer = Array.isArray(offers) ? offers[0] : offers;
  if (!offer || typeof offer !== "object" || Array.isArray(offer)) return null;
  const currency = text(offer.priceCurrency);
  if (currency && currency.toUpperCase() !== "DKK") return null;
  const amount = Number(String(text(offer.price) ?? "").replace(",", "."));
  return text(offer.price) !== null && Number.isFinite(amount) && amount >= 0 && amount <= 100_000 ? Math.round(amount * 100) : null;
}

function link(value: Json | undefined, base: string): string | null {
  const raw = typeof value === "object" && value && !Array.isArray(value) ? text(value.url) : text(value);
  if (!raw) return null;
  try { return webUrl(new URL(raw, base).href); } catch { return null; }
}

function found(node: { [key: string]: Json }, base: string): Found | null {
  const title = text(node.name);
  const start = eventTime(text(node.startDate));
  if (!title || !start) return null;
  if (/Cancelled|Postponed/i.test(text(node.eventStatus) ?? "")) return null;
  const end = eventTime(text(node.endDate));
  const online = /Online/i.test(text(node.eventAttendanceMode) ?? "") && !/Mixed/i.test(text(node.eventAttendanceMode) ?? "");
  const organizer = node.organizer;
  const description = text(node.description);
  return {
    title: title.slice(0, 200), startsAtMs: start.ms, allDay: start.allDay,
    // An all-day end date names the last day; the event lasts until that day is over.
    endsAtMs: end ? (end.allDay ? end.ms + DAY : end.ms) : null,
    location: online ? "Online" : place(node.location), description, link: link(node.url, base) ?? link(node["@id"], base),
    imageUrl: link(Array.isArray(node.image) ? node.image[0] : node.image, base),
    organizer: typeof organizer === "object" && organizer && !Array.isArray(organizer) ? text(organizer.name) : text(organizer),
    priceMinor: price(node.offers) ?? extractPriceMinor(description)
  };
}

/** Every schema.org event in a page's JSON-LD blocks, also inside @graph and an organization's list. */
export function extractEvents(html: string, base: string): Found[] {
  const out: Found[] = [];
  const walk = (node: Json, depth: number) => {
    if (depth > 6 || !node || typeof node !== "object") return;
    if (Array.isArray(node)) { for (const item of node.slice(0, 500)) walk(item, depth + 1); return; }
    if (isEvent(node)) { const event = found(node, base); if (event) out.push(event); }
    for (const key of ["@graph", "event", "events", "subEvent", "itemListElement", "item"]) if (key in node) walk(node[key]!, depth + 1);
  };
  for (const block of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const body = block[1]!.replace(/^\s*(?:<!--|\/\/<!\[CDATA\[)|(?:-->|\/\/\]\]>)\s*$/g, "").trim();
    try { walk(JSON.parse(body) as Json, 0); } catch { /* a broken block is skipped; the rest of the page still counts */ }
  }
  return out;
}

/** A calendar address on the page: a subscription link (webcal://, .ics) or an event feed. */
export function findFeed(html: string, base: string): string | null {
  const candidates: string[] = [];
  for (const tag of html.matchAll(/<link\b[^>]*>/gi)) {
    const t = tag[0];
    if (!/rel=["']?alternate/i.test(t)) continue;
    const href = /href=["']([^"']+)["']/i.exec(t)?.[1];
    if (href && (/text\/calendar/i.test(t) || (/rss\+xml/i.test(t) && /event|kalender|arrangement|calendar/i.test(t + href)))) candidates.push(href);
  }
  for (const a of html.matchAll(/href=["']([^"']+)["']/gi)) {
    const href = a[1]!.replace(/&amp;/g, "&");
    if (/^webcals?:\/\//i.test(href) || /\.ics(?:$|\?)/i.test(href) || /[?&](?:ical|outlook-ical)=/i.test(href)) candidates.push(href);
  }
  for (const href of candidates) {
    try {
      const url = webUrl(new URL(href.replace(/^webcals?:\/\//i, "https://"), base).href);
      if (url) return url;
    } catch { /* not an address */ }
  }
  return null;
}

/** Whether robots.txt lets the scanner read a path: the longest matching rule wins, as search engines do. */
export function robotsAllow(robots: string, path: string): boolean {
  const groups: Array<{ agents: string[]; rules: Array<{ allow: boolean; pattern: string }> }> = [];
  let current: (typeof groups)[number] | null = null, lastWasAgent = false;
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1]!.toLowerCase(), value = m[2]!.trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) { current = { agents: [], rules: [] }; groups.push(current); }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((key === "allow" || key === "disallow") && current) {
      if (value) current.rules.push({ allow: key === "allow", pattern: value });
      lastWasAgent = false;
    }
  }
  const mine = groups.filter(g => g.agents.some(a => a !== "*" && "eventportal-scanner".includes(a)));
  const rules = (mine.length ? mine : groups.filter(g => g.agents.includes("*"))).flatMap(g => g.rules);
  let best: { allow: boolean; length: number } = { allow: true, length: -1 };
  for (const rule of rules) {
    const re = new RegExp("^" + rule.pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$"));
    if (re.test(path) && (rule.pattern.length > best.length || (rule.pattern.length === best.length && rule.allow))) best = { allow: rule.allow, length: rule.pattern.length };
  }
  return best.allow;
}

// ---- Keeping finds ----

const normal = (title: string) => title.toLocaleLowerCase("da-DK").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** An event already shown at about the same time with about the same title. */
async function alreadyShown(db: D1Database, f: Pick<Found, "title" | "startsAtMs">): Promise<number | null> {
  const rows = (await db.prepare("SELECT id, title FROM events WHERE hidden = 0 AND removed_at_ms IS NULL AND starts_at_ms BETWEEN ? AND ?")
    .bind(f.startsAtMs - HOUR / 2, f.startsAtMs + HOUR / 2).all<{ id: number; title: string }>()).results ?? [];
  const mine = normal(f.title);
  return rows.find(r => { const theirs = normal(r.title); return theirs === mine || (mine.length > 5 && theirs.includes(mine)) || (theirs.length > 5 && mine.includes(theirs)); })?.id ?? null;
}

/** Queues a find once; returns whether it was new. */
export async function queueFind(db: D1Database, f: Found, origin: "scan" | "tip", meta: { siteId?: number | null; contact?: string | null; region?: string }, nowMs: number): Promise<boolean> {
  const fingerprint = contentHash(JSON.stringify([origin, meta.siteId ?? null, normal(f.title), f.startsAtMs, origin === "tip" ? meta.contact ?? null : f.link]));
  const result = await db.prepare(`INSERT INTO candidates (region, origin, site_id, fingerprint, title, starts_at_ms, ends_at_ms, all_day, location, description, link, image_url, organizer,
      price_minor, contact, duplicate_of, created_at_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(fingerprint) DO NOTHING`)
    .bind(meta.region ?? "ostjylland", origin, meta.siteId ?? null, fingerprint, f.title, f.startsAtMs, f.endsAtMs, f.allDay ? 1 : 0, f.location, f.description, f.link, f.imageUrl,
      f.organizer, f.priceMinor, meta.contact ?? null, await alreadyShown(db, f), nowMs).run();
  return Number(result.meta?.changes ?? 0) === 1;
}

export type Site = {
  id: number; region: string; url: string; name: string | null; status: "active" | "paused"; feed_url: string | null; source_id: number | null;
  last_scan_at_ms: number | null; last_scan_ok: number | null; last_scan_message: string | null; created_at_ms: number;
};

async function fetchText(deps: Pick<Deps, "fetcher">, url: string, maxBytes: number): Promise<{ ok: true; text: string } | { ok: false; status: number | null }> {
  try {
    const response = await deps.fetcher(url, { redirect: "follow", signal: AbortSignal.timeout(15_000), headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.5" } });
    if (!response.ok) return { ok: false, status: response.status };
    const text = await readLimited(response, maxBytes);
    return text === null ? { ok: false, status: 413 } : { ok: true, text };
  } catch { return { ok: false, status: null }; }
}

/** Reads one site's page; returns how many new finds were queued. */
export async function scanSite(db: D1Database, deps: Pick<Deps, "fetcher" | "now">, site: Site): Promise<{ ok: boolean; message: string; queued: number }> {
  const now = deps.now();
  const finish = async (ok: boolean, message: string, queued = 0, feed?: string | null) => {
    await db.prepare("UPDATE scan_sites SET last_scan_at_ms = ?, last_scan_ok = ?, last_scan_message = ?, feed_url = COALESCE(?, feed_url) WHERE id = ?")
      .bind(now, ok ? 1 : 0, message.slice(0, 300), feed ?? null, site.id).run();
    return { ok, message, queued };
  };
  const url = new URL(site.url);
  const robots = await fetchText(deps, `${url.origin}/robots.txt`, 200_000);
  if (robots.ok && !robotsAllow(robots.text, url.pathname + url.search)) return finish(false, "Siden beder robotter om ikke at læse den (robots.txt). Den læses ikke.");
  const page = await fetchText(deps, site.url, MAX_PAGE_BYTES);
  if (!page.ok) return finish(false, page.status === 413 ? "Siden er for stor (over 2 MB)." : page.status ? `Siden svarede med fejl ${page.status}.` : "Siden kunne ikke hentes.");
  const feed = findFeed(page.text, site.url);
  const events = extractEvents(page.text, site.url).filter(e => (e.endsAtMs ?? e.startsAtMs + 3 * HOUR) >= now && e.startsAtMs < now + WINDOW_DAYS * DAY).slice(0, 200);
  let queued = 0;
  for (const event of events) if (await queueFind(db, event, "scan", { siteId: site.id, region: site.region }, now)) queued++;
  const parts = [`${events.length} kommende event${events.length === 1 ? "" : "s"} på siden`, `${queued} nye i køen`];
  if (feed) parts.push("kalenderadresse fundet");
  if (!events.length && !feed) parts.push("ingen eventdata på siden - prøv sidens eventoversigt");
  return finish(true, parts.join(" · "), queued, feed);
}

/** From the cron: a few sites an hour, each one once a week. A site whose calendar is already an
 * organizer is not read: the calendar is the truth. */
export async function runScanner(env: Env, deps: Deps): Promise<void> {
  const db = env.DB;
  if (!db) return;
  const now = deps.now();
  if (!(await claimJob(db, "scan", Math.floor(now / HOUR), now))) return;
  const sites = (await db.prepare(`SELECT * FROM scan_sites WHERE status = 'active' AND source_id IS NULL AND (last_scan_at_ms IS NULL OR last_scan_at_ms < ?)
      ORDER BY last_scan_at_ms IS NOT NULL, last_scan_at_ms LIMIT ?`).bind(now - RESCAN_DAYS * DAY, SITES_PER_RUN).all<Site>()).results ?? [];
  for (const site of sites) await scanSite(db, deps, site).catch(error => console.warn("scan_failed", site.id, error instanceof Error ? error.message : error));
}

// ---- Deciding ----

export type Candidate = {
  id: number; region: string; origin: "scan" | "tip"; site_id: number | null; title: string; starts_at_ms: number; ends_at_ms: number | null; all_day: number;
  location: string | null; description: string | null; link: string | null; image_url: string | null; organizer: string | null; price_minor: number | null;
  contact: string | null; duplicate_of: number | null; status: "new" | "approved" | "rejected"; event_id: number | null; created_at_ms: number;
};

/** Shows an approved find: as an event of the chosen organizer (one without a calendar). */
export async function approveCandidate(db: D1Database, candidate: Candidate, source: Source, choice: { topic: string; address: string | null }, nowMs: number): Promise<number> {
  const online = isOnline(candidate.location);
  const venue = online ? null : await venueFor(db, choice.address || addressFor(candidate.location, source.default_address));
  const topic = choice.topic || topicFor(candidate.title, candidate.description, source.default_topic);
  const priceMinor = candidate.price_minor ?? extractPriceMinor(`${candidate.title}\n${candidate.description ?? ""}`);
  const values = [candidate.title, candidate.starts_at_ms, candidate.ends_at_ms, candidate.all_day, online ? 1 : 0, candidate.location, venue, candidate.description, candidate.link,
    candidate.image_url, topic, priceMinor];
  const result = await db.prepare(`INSERT INTO events (source_id, source_uid, title, starts_at_ms, ends_at_ms, all_day, online, location, venue_id, description, link, image_url, topic,
      price_minor, content_hash, first_seen_at_ms, updated_at_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(source_id, source_uid) DO UPDATE SET hidden = 0, removed_at_ms = NULL, updated_at_ms = excluded.updated_at_ms`)
    .bind(source.id, `fund-${candidate.id}`, ...values, contentHash(JSON.stringify(values)), nowMs, nowMs).run();
  const eventId = Number(result.meta?.last_row_id)
    || (await db.prepare("SELECT id FROM events WHERE source_id = ? AND source_uid = ?").bind(source.id, `fund-${candidate.id}`).first<{ id: number }>())!.id;
  await db.prepare("UPDATE candidates SET status = 'approved', event_id = ?, decided_at_ms = ? WHERE id = ?").bind(eventId, nowMs, candidate.id).run();
  return eventId;
}

export async function rejectCandidate(db: D1Database, id: number, nowMs: number): Promise<void> {
  await db.prepare("UPDATE candidates SET status = 'rejected', decided_at_ms = ? WHERE id = ? AND status = 'new'").bind(nowMs, id).run();
}

// ---- Tips from visitors ----

export type TipResult = { ok: true } | { ok: false; error: string; values: Record<string, string> };

const TIP_FIELDS = ["title", "date", "time", "end", "place", "link", "organizer", "description", "contact"] as const;

/** A visitor's tip, checked. It goes in the queue like any other find. */
export async function takeTip(db: D1Database, form: FormData, request: Request, nowMs: number): Promise<TipResult> {
  const values = Object.fromEntries(TIP_FIELDS.map(k => [k, String(form.get(k) ?? "").trim().slice(0, k === "description" ? 3000 : 300)])) as Record<(typeof TIP_FIELDS)[number], string>;
  const fail = (error: string): TipResult => ({ ok: false, error, values });
  // A field people never see: only robots fill it in.
  if (String(form.get("hjemmeside") ?? "")) return { ok: true };
  const bucket = `tip:${request.headers.get("cf-connecting-ip") ?? "ukendt"}`;
  const seen = await db.prepare("SELECT attempts, at_ms FROM login_attempts WHERE bucket = ?").bind(bucket).first<{ attempts: number; at_ms: number }>();
  if (seen && seen.at_ms > nowMs - HOUR && seen.attempts >= 5) return fail("Du har sendt mange tips på kort tid. Prøv igen om en time.");
  if (!values.title) return fail("Skriv eventets titel.");
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(values.date);
  if (!date) return fail("Vælg en dato.");
  const time = /^(\d{1,2})[:.](\d{2})$/.exec(values.time), end = /^(\d{1,2})[:.](\d{2})$/.exec(values.end);
  if (values.time && !time) return fail("Skriv tidspunktet som fx 19.00.");
  const start = zonedMs(+date[1]!, +date[2]!, +date[3]!, time ? +time[1]! : 0, time ? +time[2]! : 0, 0, ZONE);
  if (start < nowMs - DAY || start > nowMs + WINDOW_DAYS * DAY) return fail("Datoen skal ligge inden for det næste halve år.");
  const endMs = end ? zonedMs(+date[1]!, +date[2]!, +date[3]!, +end[1]!, +end[2]!, 0, ZONE) : null;
  if (!values.place) return fail("Skriv hvor eventet foregår (adresse eller \"Online\").");
  const link = values.link ? webUrl(/^https?:\/\//i.test(values.link) ? values.link : `https://${values.link}`) : null;
  if (values.link && !link) return fail("Linket skal være en almindelig webadresse.");
  const contact = values.contact.toLowerCase() || null;
  if (contact && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) return fail("E-mailen ser forkert ud.");
  await db.prepare(`INSERT INTO login_attempts (bucket, attempts, at_ms) VALUES (?, 1, ?) ON CONFLICT(bucket) DO UPDATE SET
      attempts = CASE WHEN at_ms > ? THEN attempts + 1 ELSE 1 END, at_ms = CASE WHEN at_ms > ? THEN at_ms ELSE excluded.at_ms END`).bind(bucket, nowMs, nowMs - HOUR, nowMs - HOUR).run();
  const description = values.description || null;
  await queueFind(db, { title: values.title, startsAtMs: start, endsAtMs: endMs && endMs > start ? endMs : null, allDay: !time, location: values.place, description, link, imageUrl: null,
    organizer: values.organizer || null, priceMinor: extractPriceMinor(description) }, "tip", { contact }, nowMs);
  return { ok: true };
}
