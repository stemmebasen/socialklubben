import type { Deps, Env } from "../env.js";
import { copenhagenDay } from "../events.js";
import { retryVenue, setVenueByHand } from "../geocode.js";
import { createSource, getSource, setEventHidden, setSourceStatus, sourceInput, syncSource, updateSource } from "../sources.js";
import { cookie, loginBlocked, passwordMatches, readCookie, recordFailedLogin, SESSION_COOKIE, SESSION_DAYS, sessionValue, validSession } from "./auth.js";
import { formValuesFrom, loginPage, sourcePage, sourcesPage, venuesPage, type AdminEvent, type AdminVenue, type FormValues, type ListedSource } from "./pages.js";
import { approveCandidate, rejectCandidate, scanSite, type Candidate, type Site } from "../scan.js";
import { webUrl } from "../feed.js";
import { isTopic } from "../topics.js";
import { findsPage, sitesPage } from "./scanPages.js";
import type { Source } from "../sources.js";

/** The administration: add an organizer's calendar once, and the portal does the rest. */

export const isAdminPath = (path: string) => path === "/admin" || path.startsWith("/admin/");

const HEADERS = { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow", "x-frame-options": "DENY", "referrer-policy": "same-origin",
  "content-security-policy": "default-src 'none'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" };
const page = (body: string, status = 200, extra: Record<string, string> = {}) => new Response(body, { status, headers: { ...HEADERS, ...extra } });
const redirect = (location: string, setCookie?: string) => new Response(null, { status: 303, headers: { location, "cache-control": "no-store", ...(setCookie ? { "set-cookie": setCookie } : {}) } });

const SOURCE_NOTICES: Record<string, string> = { hentet: "Kalenderen er hentet.", fejl: "Kalenderen kunne ikke læses - se fejlen ovenfor. De viste events er beholdt.", gemt: "Gemt.",
  pause: "Kilden er sat på pause; dens events vises ikke.", activate: "Kilden er aktiv igen.", skjult: "Eventet er skjult på siden.", vist: "Eventet vises igen.", ukendt: "Eventet blev ikke fundet." };

export async function handleAdmin(request: Request, env: Env, deps: Deps): Promise<Response> {
  const url = new URL(request.url);
  const now = deps.now();
  const secure = url.protocol === "https:";
  const db = env.DB;
  const configured = Boolean(env.ADMIN_PASSWORD);
  if (!db) return page(loginPage(env, "Databasen er ikke forbundet.", configured), 503);
  // Forms are only taken from the administration's own pages.
  if (request.method === "POST" && request.headers.get("origin") !== url.origin) return page(loginPage(env, "Formularen kom fra et andet sted. Prøv igen.", configured), 403);

  if (url.pathname === "/admin/login" && request.method === "POST") {
    if (!env.ADMIN_PASSWORD) return page(loginPage(env, "", false), 503);
    if (await loginBlocked(db, request, now)) return page(loginPage(env, "For mange forsøg. Vent et kvarter, og prøv igen.", true), 429);
    const given = String((await request.formData().catch(() => null))?.get("password") ?? "");
    if (!given || !(await passwordMatches(given, env.ADMIN_PASSWORD))) {
      await recordFailedLogin(db, request, now);
      return page(loginPage(env, "Forkert adgangskode.", true), 401);
    }
    return redirect("/admin", cookie(SESSION_COOKIE, await sessionValue(env.ADMIN_PASSWORD, now), SESSION_DAYS * 86_400, secure));
  }
  if (url.pathname === "/admin/logout" && request.method === "POST") return redirect("/admin", cookie(SESSION_COOKIE, "", 0, secure));
  if (!(await validSession(env.ADMIN_PASSWORD, readCookie(request, SESSION_COOKIE), now))) return page(loginPage(env, "", configured), configured ? 401 : 503);

  const since = copenhagenDay(now - 29 * 86_400_000);
  const listSources = async () => (await db.prepare(`SELECT s.*, (SELECT COUNT(*) FROM events e WHERE e.source_id = s.id AND e.hidden = 0 AND e.removed_at_ms IS NULL AND e.starts_at_ms >= ?) AS coming,
      (SELECT COALESCE(SUM(n), 0) FROM clicks c WHERE c.source_id = s.id AND c.day >= ?) AS clicks FROM sources s ORDER BY s.status, s.name COLLATE NOCASE`)
    .bind(now, since).all<ListedSource>()).results ?? [];
  const pendingVenues = async () => Number((await db.prepare("SELECT COUNT(*) AS n FROM venues WHERE status IN ('pending', 'not_found')").first<{ n: number }>())?.n ?? 0);

  if (url.pathname === "/admin" || url.pathname === "/admin/") {
    // A calendar the scanner found arrives here filled in, ready to become an organizer.
    const prefill: FormValues = url.searchParams.has("ny") ? { name: url.searchParams.get("name") ?? "", website: url.searchParams.get("website") ?? "", feed_url: url.searchParams.get("feed_url") ?? "" } : {};
    return page(sourcesPage(env, { sources: await listSources(), pendingVenues: await pendingVenues(), notice: url.searchParams.get("besked") === "oprettet" ? "Kilden er oprettet." : "", error: "", values: prefill }));
  }
  if (url.pathname === "/admin/kilder" && request.method === "POST") {
    const form = await request.formData().catch(() => null);
    const parsed = form ? sourceInput(form) : { ok: false as const, error: "Formularen kunne ikke læses." };
    if (!parsed.ok) return page(sourcesPage(env, { sources: await listSources(), pendingVenues: await pendingVenues(), notice: "", error: parsed.error, values: formValuesFrom(form) }), 400);
    const id = await createSource(db, parsed.value, now);
    // A site whose calendar this is stops being read by the scanner: the calendar is the truth now.
    if (parsed.value.feedUrl) await db.prepare("UPDATE scan_sites SET source_id = ? WHERE feed_url = ? AND source_id IS NULL").bind(id, parsed.value.feedUrl).run();
    const result = await syncSource(db, deps, (await getSource(db, id))!);
    return redirect(`/admin/kilder/${id}?besked=${result.ok ? "hentet" : "fejl"}`);
  }
  const sourcePath = /^\/admin\/kilder\/(\d{1,9})$/.exec(url.pathname);
  if (sourcePath) {
    const id = Number(sourcePath[1]);
    const source = await getSource(db, id);
    if (!source) return page(sourcesPage(env, { sources: await listSources(), pendingVenues: await pendingVenues(), notice: "Kilden findes ikke.", error: "", values: {} }), 404);
    const here = `/admin/kilder/${id}`;
    if (request.method === "POST") {
      const form = await request.formData().catch(() => null);
      const action = String(form?.get("action") ?? "save");
      if (action === "sync") return redirect(`${here}?besked=${(await syncSource(db, deps, source)).ok ? "hentet" : "fejl"}`);
      if (action === "pause" || action === "activate") { await setSourceStatus(db, id, action === "pause" ? "paused" : "active", now); return redirect(`${here}?besked=${action}`); }
      if (action === "hide" || action === "show") {
        const eventId = Number(form?.get("event"));
        const ok = Number.isSafeInteger(eventId) && await setEventHidden(db, id, eventId, action === "hide");
        return redirect(`${here}?besked=${ok ? (action === "hide" ? "skjult" : "vist") : "ukendt"}`);
      }
      const parsed = form ? sourceInput(form) : { ok: false as const, error: "Formularen kunne ikke læses." };
      if (!parsed.ok) return page(sourcePage(env, { source, events: await sourceEvents(env, id, now, since), notice: "", error: parsed.error, values: formValuesFrom(form) }), 400);
      await updateSource(db, id, parsed.value, now);
      if (parsed.value.feedUrl !== source.feed_url || parsed.value.includeWords !== source.include_words || parsed.value.excludeWords !== source.exclude_words
        || parsed.value.defaultAddress !== source.default_address || parsed.value.defaultTopic !== source.default_topic) {
        return redirect(`${here}?besked=${(await syncSource(db, deps, (await getSource(db, id))!)).ok ? "hentet" : "fejl"}`);
      }
      return redirect(`${here}?besked=gemt`);
    }
    return page(sourcePage(env, { source, events: await sourceEvents(env, id, now, since), notice: SOURCE_NOTICES[url.searchParams.get("besked") ?? ""] ?? "", error: "", values: null }));
  }
  if (url.pathname === "/admin/fund" && request.method === "GET") {
    const finds = (await db.prepare(`SELECT c.*, s.url AS site_url, s.name AS site_name FROM candidates c LEFT JOIN scan_sites s ON s.id = c.site_id
        WHERE c.status = 'new' AND COALESCE(c.ends_at_ms, c.starts_at_ms + 10800000) >= ? ORDER BY c.starts_at_ms LIMIT 100`).bind(now)
      .all<Candidate & { site_url: string | null; site_name: string | null }>()).results ?? [];
    const sources = (await db.prepare("SELECT * FROM sources WHERE status = 'active' ORDER BY name COLLATE NOCASE").all<Source>()).results ?? [];
    const NOTICES: Record<string, string> = { vist: "Eventet vises nu på portalen.", afvist: "Fundet er afvist.", navn: "Skriv den nye arrangørs navn.", ukendt: "Fundet blev ikke fundet." };
    return page(findsPage(env, { finds, sources, notice: NOTICES[url.searchParams.get("besked") ?? ""] ?? "" }));
  }
  const findPath = /^\/admin\/fund\/(\d{1,9})$/.exec(url.pathname);
  if (findPath && request.method === "POST") {
    const form = await request.formData().catch(() => null);
    const candidate = await db.prepare("SELECT * FROM candidates WHERE id = ? AND status = 'new'").bind(Number(findPath[1])).first<Candidate>();
    if (!candidate) return redirect("/admin/fund?besked=ukendt");
    if (form?.get("action") === "reject") { await rejectCandidate(db, candidate.id, now); return redirect("/admin/fund?besked=afvist"); }
    const topic = String(form?.get("topic") ?? "");
    const chosen = String(form?.get("source") ?? "ny");
    let source = chosen === "ny" ? null : await getSource(db, Number(chosen));
    if (!source) {
      const name = String(form?.get("new_name") ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
      if (!name) return redirect("/admin/fund?besked=navn");
      const existing = await db.prepare("SELECT id FROM sources WHERE name = ? COLLATE NOCASE").bind(name).first<{ id: number }>();
      const website = candidate.link ? webUrl(new URL(candidate.link).origin) : null;
      const id = existing?.id ?? await createSource(db, { name, website, feedUrl: "", defaultAddress: null, defaultTopic: isTopic(topic) ? topic : "udvikling", includeWords: null, excludeWords: null,
        contactEmail: null, note: candidate.origin === "tip" ? "Oprettet fra et tip." : "Oprettet fra scanneren." }, now);
      source = (await getSource(db, id))!;
    }
    await approveCandidate(db, candidate, source, { topic: isTopic(topic) ? topic : "", address: String(form?.get("address") ?? "").trim().slice(0, 200) || null }, now);
    return redirect("/admin/fund?besked=vist");
  }
  const listSites = async () => (await db.prepare("SELECT * FROM scan_sites ORDER BY source_id IS NOT NULL, status, COALESCE(name, url) COLLATE NOCASE").all<Site>()).results ?? [];
  const SITE_NOTICES: Record<string, string> = { tilfoejet: "Siden er tilføjet og læst.", laest: "Siden er læst.", pause: "Siden er sat på pause.", aktiv: "Siden læses igen hver uge.", fjernet: "Siden er fjernet." };
  if (url.pathname === "/admin/scanner" && request.method === "GET") return page(sitesPage(env, { sites: await listSites(), notice: SITE_NOTICES[url.searchParams.get("besked") ?? ""] ?? "", error: "" }));
  if (url.pathname === "/admin/scanner" && request.method === "POST") {
    const form = await request.formData().catch(() => null);
    const raw = String(form?.get("url") ?? "").trim();
    const siteUrl = webUrl(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!raw || !siteUrl) return page(sitesPage(env, { sites: await listSites(), notice: "", error: "Skriv sidens adresse, fx https://studie.dk/events." }), 400);
    const name = String(form?.get("name") ?? "").trim().slice(0, 120) || null;
    await db.prepare("INSERT INTO scan_sites (url, name, created_at_ms) VALUES (?, ?, ?) ON CONFLICT(url) DO UPDATE SET name = COALESCE(excluded.name, name), status = 'active'").bind(siteUrl, name, now).run();
    const site = await db.prepare("SELECT * FROM scan_sites WHERE url = ?").bind(siteUrl).first<Site>();
    if (site && !site.source_id) await scanSite(db, deps, site);
    return redirect("/admin/scanner?besked=tilfoejet");
  }
  const sitePath = /^\/admin\/scanner\/(\d{1,9})$/.exec(url.pathname);
  if (sitePath && request.method === "POST") {
    const form = await request.formData().catch(() => null);
    const site = await db.prepare("SELECT * FROM scan_sites WHERE id = ?").bind(Number(sitePath[1])).first<Site>();
    if (!site) return redirect("/admin/scanner");
    const action = String(form?.get("action") ?? "");
    if (action === "scan" && !site.source_id) { await scanSite(db, deps, site); return redirect("/admin/scanner?besked=laest"); }
    if (action === "pause" || action === "activate") {
      await db.prepare("UPDATE scan_sites SET status = ? WHERE id = ?").bind(action === "pause" ? "paused" : "active", site.id).run();
      return redirect(`/admin/scanner?besked=${action === "pause" ? "pause" : "aktiv"}`);
    }
    if (action === "delete") {
      // Finds already decided keep their history; the ones waiting go with the site.
      await db.prepare("DELETE FROM candidates WHERE site_id = ? AND status = 'new'").bind(site.id).run();
      await db.prepare("UPDATE candidates SET site_id = NULL WHERE site_id = ?").bind(site.id).run();
      await db.prepare("DELETE FROM scan_sites WHERE id = ?").bind(site.id).run();
      return redirect("/admin/scanner?besked=fjernet");
    }
    return redirect("/admin/scanner");
  }
  if (url.pathname === "/admin/steder") {
    const venues = (await db.prepare(`SELECT v.id, v.address, v.lat, v.lng, v.status, v.attempts,
        (SELECT COUNT(*) FROM events e WHERE e.venue_id = v.id AND e.removed_at_ms IS NULL AND e.starts_at_ms >= ?) AS events FROM venues v
        ORDER BY CASE v.status WHEN 'not_found' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END, events DESC, v.address LIMIT 300`).bind(now).all<AdminVenue>()).results ?? [];
    const NOTICES: Record<string, string> = { sat: "Stedet er sat i hånden.", igen: "Stedet slås op igen ved næste kørsel (inden for et kvarter).", fejl: "Skriv koordinaterne som to tal, fx 56.1567, 10.2108." };
    return page(venuesPage(env, { venues, notice: NOTICES[url.searchParams.get("besked") ?? ""] ?? "" }));
  }
  const venuePath = /^\/admin\/steder\/(\d{1,9})$/.exec(url.pathname);
  if (venuePath && request.method === "POST") {
    const form = await request.formData().catch(() => null);
    const id = Number(venuePath[1]);
    if (form?.get("action") === "retry") { await retryVenue(db, id); return redirect("/admin/steder?besked=igen"); }
    const match = /^\s*(-?\d{1,2}(?:[.,]\d+)?)\s*[,; ]\s*(-?\d{1,3}(?:[.,]\d+)?)\s*$/.exec(String(form?.get("coords") ?? ""));
    const ok = match ? await setVenueByHand(db, id, Number(match[1]!.replace(",", ".")), Number(match[2]!.replace(",", ".")), now) : false;
    return redirect(`/admin/steder?besked=${ok ? "sat" : "fejl"}`);
  }
  return page(sourcesPage(env, { sources: await listSources(), pendingVenues: await pendingVenues(), notice: "Siden findes ikke.", error: "", values: {} }), 404);
}

async function sourceEvents(env: Env, sourceId: number, nowMs: number, since: string): Promise<AdminEvent[]> {
  const rows = await env.DB!.prepare(`SELECT e.id, e.title, e.starts_at_ms, e.all_day, e.online, e.topic, e.hidden, e.removed_at_ms, v.status AS venue_status,
      (SELECT COALESCE(SUM(n), 0) FROM clicks c WHERE c.event_id = e.id AND c.day >= ?) AS clicks
    FROM events e LEFT JOIN venues v ON v.id = e.venue_id WHERE e.source_id = ? AND COALESCE(e.ends_at_ms, e.starts_at_ms + 10800000) >= ? ORDER BY e.starts_at_ms LIMIT 300`)
    .bind(since, sourceId, nowMs).all<AdminEvent>();
  return rows.results ?? [];
}
