import type { D1Database } from "./db.js";
import type { Deps, Env } from "./env.js";
import { contentHash, parseFeed, webUrl, type FeedEvent } from "./feed.js";
import { addressFor, isOnline, venueFor } from "./geocode.js";
import { extractPriceMinor } from "./price.js";
import { isTopic, passesWords, topicFor } from "./topics.js";

/** The organizers' calendars. The administration adds an organizer's public calendar address once; from
 * then on the portal reads it every hour and keeps the coming events in step - new, changed, cancelled,
 * removed and past - without the organizer doing anything. Ported from Hjerterum's partner calendar sync
 * (Partnerplanen, fase 1). */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** How far ahead events are shown. */
export const WINDOW_DAYS = 180;
const MAX_EVENTS_PER_SOURCE = 300;
const MAX_FEED_BYTES = 3_000_000;
const MAX_SOURCES_PER_RUN = 40;

export type Source = {
  id: number; region: string; name: string; website: string | null; feed_url: string; default_address: string | null; default_topic: string;
  include_words: string | null; exclude_words: string | null; benefit: string | null; status: "active" | "paused"; contact_email: string | null; note: string | null;
  last_sync_at_ms: number | null; last_sync_ok: number | null; last_sync_message: string | null; created_at_ms: number; updated_at_ms: number;
  /** "manual": no calendar; its events are finds the administration approved (src/scan.ts). */
  kind: "feed" | "manual";
};
export type SourceInput = {
  name: string; website: string | null; feedUrl: string; defaultAddress: string | null; defaultTopic: string; includeWords: string | null; excludeWords: string | null;
  contactEmail: string | null; note: string | null;
};

const field = (form: FormData, name: string, max: number) => String(form.get(name) ?? "").trim().replace(/\s+/g, " ").slice(0, max);

/** The administration's form, checked; every error is a sentence one can act on. */
export function sourceInput(form: FormData): { ok: true; value: SourceInput } | { ok: false; error: string } {
  const name = field(form, "name", 120);
  if (!name) return { ok: false, error: "Skriv arrangørens navn." };
  const websiteText = field(form, "website", 300);
  const website = websiteText ? webUrl(/^https?:\/\//i.test(websiteText) ? websiteText : `https://${websiteText}`) : null;
  if (websiteText && !website) return { ok: false, error: "Hjemmesiden skal være en almindelig webadresse." };
  const feedText = field(form, "feed_url", 500).replace(/^webcals?:\/\//i, "https://");
  // An organizer without a calendar gets its events one by one from approved finds.
  const feedUrl = feedText ? webUrl(feedText, true) : "";
  if (feedUrl === null) return { ok: false, error: "Kalenderadressen skal begynde med https:// (eller webcal://), eller stå tom for en arrangør uden kalender." };
  const defaultTopic = field(form, "default_topic", 40);
  if (!isTopic(defaultTopic)) return { ok: false, error: "Vælg den kategori, arrangøren oftest har." };
  const contactEmail = field(form, "contact_email", 200).toLowerCase() || null;
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) return { ok: false, error: "Kontaktens e-mail ser forkert ud." };
  return { ok: true, value: { name, website, feedUrl, defaultTopic, contactEmail, defaultAddress: field(form, "default_address", 200) || null,
    includeWords: field(form, "include_words", 300) || null, excludeWords: field(form, "exclude_words", 300) || null,
    note: String(form.get("note") ?? "").trim().slice(0, 1000) || null } };
}

export async function createSource(db: D1Database, input: SourceInput, nowMs: number): Promise<number> {
  const result = await db.prepare(`INSERT INTO sources (name, website, feed_url, kind, default_address, default_topic, include_words, exclude_words, contact_email, note, created_at_ms, updated_at_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(input.name, input.website, input.feedUrl, input.feedUrl ? "feed" : "manual", input.defaultAddress, input.defaultTopic, input.includeWords,
      input.excludeWords, input.contactEmail, input.note, nowMs, nowMs).run();
  return Number(result.meta?.last_row_id);
}

export async function updateSource(db: D1Database, id: number, input: SourceInput, nowMs: number): Promise<void> {
  await db.prepare(`UPDATE sources SET name = ?, website = ?, feed_url = ?, kind = ?, default_address = ?, default_topic = ?, include_words = ?, exclude_words = ?, contact_email = ?,
    note = ?, updated_at_ms = ? WHERE id = ?`).bind(input.name, input.website, input.feedUrl, input.feedUrl ? "feed" : "manual", input.defaultAddress, input.defaultTopic, input.includeWords,
      input.excludeWords, input.contactEmail, input.note, nowMs, id).run();
}

export async function setSourceStatus(db: D1Database, id: number, status: Source["status"], nowMs: number): Promise<void> {
  await db.prepare("UPDATE sources SET status = ?, updated_at_ms = ? WHERE id = ?").bind(status, nowMs, id).run();
}

export const getSource = (db: D1Database, id: number) => db.prepare("SELECT * FROM sources WHERE id = ?").bind(id).first<Source>();

export async function setEventHidden(db: D1Database, sourceId: number, eventId: number, hidden: boolean): Promise<boolean> {
  const result = await db.prepare("UPDATE events SET hidden = ? WHERE id = ? AND source_id = ?").bind(hidden ? 1 : 0, eventId, sourceId).run();
  return Number(result.meta?.changes ?? 0) === 1;
}

// ---- Reading a calendar ----

/** The body as text, or null once it passes maxBytes - a huge calendar is never read whole into memory. */
export async function readLimited(response: Response, maxBytes: number): Promise<string | null> {
  if (Number(response.headers.get("content-length") ?? 0) > maxBytes) return null;
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel().catch(() => undefined); return null; }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

const COLUMNS = ["source_id", "source_uid", "title", "starts_at_ms", "ends_at_ms", "all_day", "online", "location", "venue_id", "description", "link", "image_url", "topic",
  "price_minor", "content_hash", "removed_at_ms", "first_seen_at_ms", "updated_at_ms"] as const;
const ROWS_PER_STATEMENT = 5; // D1 takes at most 100 bound values per statement.

export type SyncResult = { ok: boolean; message: string; coming: number; written: number };

/** Reads one organizer's calendar and writes what is new, changed or gone. A failing calendar leaves
 * the events already shown as they are, and says why in the administration. */
export async function syncSource(db: D1Database, deps: Pick<Deps, "fetcher" | "now">, source: Source): Promise<SyncResult> {
  const now = deps.now();
  if (source.kind === "manual") return { ok: true, message: "Arrangør uden kalender: events kommer fra godkendte fund.", coming: 0, written: 0 };
  const finish = async (result: SyncResult) => {
    await db.prepare("UPDATE sources SET last_sync_at_ms = ?, last_sync_ok = ?, last_sync_message = ? WHERE id = ?")
      .bind(now, result.ok ? 1 : 0, result.message.slice(0, 300), source.id).run();
    return result;
  };
  let text: string | null;
  try {
    const response = await deps.fetcher(source.feed_url, { redirect: "follow", signal: AbortSignal.timeout(15_000),
      headers: { accept: "text/calendar, application/rss+xml, application/xml;q=0.9, */*;q=0.5", "user-agent": "Socialklubben kalenderlæser" } });
    if (!response.ok) return finish({ ok: false, message: `Kalenderen svarede med fejl ${response.status}. De viste events er beholdt.`, coming: 0, written: 0 });
    text = await readLimited(response, MAX_FEED_BYTES);
  } catch (error) {
    const timeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return finish({ ok: false, message: timeout ? "Kalenderen svarede ikke inden for 15 sekunder. De viste events er beholdt." : "Kalenderen kunne ikke hentes. De viste events er beholdt.", coming: 0, written: 0 });
  }
  if (text === null) return finish({ ok: false, message: "Kalenderen er for stor (over 3 MB). Bed arrangøren om en adresse med kun kommende events.", coming: 0, written: 0 });
  const feed = parseFeed(text);
  if (!feed) return finish({ ok: false, message: "Adressen er hverken en iCal- eller RSS-kalender. Tjek, at det er kalenderens abonnements- eller eksportadresse.", coming: 0, written: 0 });

  const inWindow = feed.events
    .filter(e => (e.endsAtMs ?? e.startsAtMs + 3 * HOUR) >= now && e.startsAtMs < now + WINDOW_DAYS * DAY)
    .sort((a, b) => a.startsAtMs - b.startsAtMs);
  const wanted = inWindow.filter(e => passesWords(`${e.title}\n${e.description ?? ""}`, source.include_words, source.exclude_words));
  const uids = new Set<string>();
  const events = wanted.filter(e => !uids.has(e.uid) && uids.add(e.uid)).slice(0, MAX_EVENTS_PER_SOURCE);

  const known = new Map(((await db.prepare("SELECT source_uid, content_hash, removed_at_ms FROM events WHERE source_id = ?").bind(source.id)
    .all<{ source_uid: string; content_hash: string; removed_at_ms: number | null }>()).results ?? []).map(r => [r.source_uid, r]));
  const rows: unknown[][] = [];
  const venues = new Map<string, number | null>(); // one lookup per address, however many events are there
  for (const event of events) {
    const row = await eventRow(db, source, event, now, venues);
    const was = known.get(event.uid);
    if (!was || was.content_hash !== row[14] || (was.removed_at_ms !== null) !== (row[15] !== null)) rows.push(row);
  }
  for (let i = 0; i < rows.length; i += ROWS_PER_STATEMENT) {
    const chunk = rows.slice(i, i + ROWS_PER_STATEMENT);
    await db.prepare(`INSERT INTO events (${COLUMNS.join(", ")}) VALUES ${chunk.map(() => `(${COLUMNS.map(() => "?").join(", ")})`).join(", ")}
      ON CONFLICT(source_id, source_uid) DO UPDATE SET title = excluded.title, starts_at_ms = excluded.starts_at_ms, ends_at_ms = excluded.ends_at_ms, all_day = excluded.all_day,
      online = excluded.online, location = excluded.location, venue_id = excluded.venue_id, description = excluded.description, link = excluded.link, image_url = excluded.image_url,
      topic = excluded.topic, price_minor = excluded.price_minor, content_hash = excluded.content_hash, removed_at_ms = excluded.removed_at_ms, updated_at_ms = excluded.updated_at_ms`)
      .bind(...chunk.flat()).run();
  }
  // A coming event no longer in the calendar (or no longer passing the organizer's filter) was taken off.
  const gone = [...known.keys()].filter(uid => !uids.has(uid));
  for (let i = 0; i < gone.length; i += 90) {
    const chunk = gone.slice(i, i + 90);
    await db.prepare(`UPDATE events SET removed_at_ms = ?, updated_at_ms = ? WHERE source_id = ? AND removed_at_ms IS NULL AND starts_at_ms > ?
      AND source_uid IN (${chunk.map(() => "?").join(", ")})`).bind(now, now, source.id, now, ...chunk).run();
  }
  const coming = events.filter(e => !e.cancelled).length;
  const parts = [`${coming} kommende event${coming === 1 ? "" : "s"} (${feed.kind === "ics" ? "iCal" : "RSS"})`];
  if (inWindow.length > wanted.length) parts.push(`${inWindow.length - wanted.length} uden for arrangørens filter`);
  if (feed.recurring) parts.push(`${feed.recurring} ${feed.recurring === 1 ? "gentagen serie" : "gentagne serier"} vises ikke endnu`);
  return finish({ ok: true, message: parts.join(" · "), coming, written: rows.length });
}

async function eventRow(db: D1Database, source: Source, event: FeedEvent, now: number, venues: Map<string, number | null>): Promise<unknown[]> {
  const online = isOnline(event.location);
  const address = online ? null : addressFor(event.location, source.default_address);
  if (address !== null && !venues.has(address)) venues.set(address, await venueFor(db, address));
  const venue = address === null ? null : venues.get(address) ?? null;
  const values = [event.title, event.startsAtMs, event.endsAtMs, event.allDay ? 1 : 0, online ? 1 : 0, event.location, venue, event.description, event.link, event.imageUrl,
    topicFor(event.title, event.description, source.default_topic), extractPriceMinor(`${event.title}\n${event.description ?? ""}`)] as const;
  return [source.id, event.uid, ...values, contentHash(JSON.stringify([...values, event.cancelled])), event.cancelled ? now : null, now, now];
}

export async function claimJob(db: D1Database, key: string, slot: number, nowMs: number): Promise<boolean> {
  const result = await db.prepare("INSERT OR IGNORE INTO job_claims (job_key, slot, claimed_at_ms) VALUES (?, ?, ?)").bind(key, slot, nowMs).run();
  return Number(result.meta?.changes ?? 0) === 1;
}

/** From the cron: every active calendar once an hour. */
export async function runSourceSync(env: Env, deps: Deps): Promise<void> {
  const db = env.DB;
  if (!db) return;
  const now = deps.now();
  if (!(await claimJob(db, "sources", Math.floor(now / HOUR), now))) return;
  const sources = (await db.prepare("SELECT * FROM sources WHERE status = 'active' AND kind = 'feed' ORDER BY id LIMIT ?").bind(MAX_SOURCES_PER_RUN).all<Source>()).results ?? [];
  for (const source of sources) {
    await syncSource(db, deps, source).catch(error => console.warn("source_sync_failed", source.id, error instanceof Error ? error.message : error));
  }
}
