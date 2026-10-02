import type { Deps, Env } from "./env.js";
import { eventById, isWhen, listEvents, organizers, outboundLink, type Filter } from "./events.js";
import { distanceKm, RADII, region as findRegion, REGIONS, type Region, type Town } from "./geo.js";
import { isTopic } from "./topics.js";
import { handleAdmin, isAdminPath } from "./admin/handler.js";
import { eventPage } from "./pages/event.js";
import { html } from "./pages/layout.js";
import { eventPath, regionPage } from "./pages/region.js";
import { aboutPage, notFoundPage, organizersPage } from "./pages/static.js";

/** The portal's routes. Static files (map script, Leaflet) are served by Workers Static Assets before
 * this is reached. */

const DENMARK = { minLat: 54.4, maxLat: 57.9, minLng: 7.9, maxLng: 15.3 };

/** A place found far outside a region belongs to another region's page (the list leaves it out too). */
const inRegion = (r: Region, e: { lat: number | null; lng: number | null }) => e.lat === null || e.lng === null || distanceKm(r, { lat: e.lat, lng: e.lng }) <= r.radiusKm;

function regionFilter(url: URL, regionSlug: string): { filter: Filter; town: Town | null; nearMe: boolean } {
  const r = findRegion(regionSlug)!;
  const nar = url.searchParams.get("nar");
  const tema = url.searchParams.get("tema");
  const kmText = Number(url.searchParams.get("km"));
  const km = (RADII as readonly number[]).includes(kmText) ? kmText : 25;
  const by = url.searchParams.get("by") ?? "";
  const town = r.towns.find(t => t.slug === by) ?? null;
  const lat = Number(url.searchParams.get("lat")), lng = Number(url.searchParams.get("lng"));
  const nearMe = !town && by === "naer" && url.searchParams.get("lat") !== null && lat >= DENMARK.minLat && lat <= DENMARK.maxLat && lng >= DENMARK.minLng && lng <= DENMARK.maxLng;
  const center = town ? { lat: town.lat, lng: town.lng } : nearMe ? { lat, lng } : null;
  const arr = Number(url.searchParams.get("arr"));
  return { filter: { when: isWhen(nar) ? nar : "maaned", topic: tema && isTopic(tema) ? tema : null, center, km: center ? km : null, sourceId: Number.isSafeInteger(arr) && arr > 0 ? arr : null },
    town, nearMe };
}

export async function handle(request: Request, env: Env, deps: Deps): Promise<Response> {
  const url = new URL(request.url);
  const origin = url.origin;
  const now = deps.now();
  if (isAdminPath(url.pathname)) return handleAdmin(request, env, deps);
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } });
  const db = env.DB;
  const missing = () => html(notFoundPage(env, origin), 404, { "cache-control": "no-store" });

  if (url.pathname === "/") return new Response(null, { status: 302, headers: { location: `/${REGIONS[0]!.slug}` } });
  if (url.pathname === "/robots.txt") return new Response(`User-agent: *\nDisallow: /admin\nDisallow: /ud/\nSitemap: ${origin}/sitemap.xml\n`, { headers: { "content-type": "text/plain; charset=utf-8" } });
  if (url.pathname === "/om") return html(aboutPage(env, origin, env.CONTACT_EMAIL?.trim() || null));
  if (url.pathname === "/health") {
    const ready = db ? await db.prepare("SELECT COUNT(*) AS n FROM sources").first<{ n: number }>().then(() => true, () => false) : false;
    return Response.json({ status: ready ? "ok" : "degraded", database: ready ? "ready" : "unavailable" }, { status: ready ? 200 : 503, headers: { "cache-control": "no-store" } });
  }
  if (!db) return new Response("Databasen er ikke forbundet.", { status: 503 });

  if (url.pathname === "/sitemap.xml") {
    const urls = REGIONS.flatMap(r => [`/${r.slug}`, `/${r.slug}/arrangorer`]).concat("/om");
    const events = ((await db.prepare(`SELECT e.id, e.title, s.region, v.lat, v.lng FROM events e JOIN sources s ON s.id = e.source_id LEFT JOIN venues v ON v.id = e.venue_id
      WHERE s.status = 'active' AND e.hidden = 0 AND e.removed_at_ms IS NULL AND e.starts_at_ms >= ? ORDER BY e.starts_at_ms LIMIT 1000`).bind(now)
      .all<{ id: number; title: string; region: string; lat: number | null; lng: number | null }>()).results ?? []).filter(e => { const r = findRegion(e.region); return r && inRegion(r, e); });
    const loc = (path: string) => `<url><loc>${(origin + path).replace(/&/g, "&amp;")}</loc></url>`;
    return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(loc).join("")}${events.map(e => loc(eventPath(e.region, e))).join("")}</urlset>`,
      { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
  }

  // On to the organizer, counted - only ever to the address the organizer's own calendar gave.
  const out = /^\/ud\/(\d{1,12})$/.exec(url.pathname);
  if (out) {
    const to = await outboundLink(db, Number(out[1]), now);
    return to ? new Response(null, { status: 302, headers: { location: to, "cache-control": "no-store", "x-robots-tag": "noindex" } }) : missing();
  }

  const [, regionSlug, rest] = /^\/([a-z-]+)(\/.*)?$/.exec(url.pathname) ?? [];
  const r = regionSlug ? findRegion(regionSlug) : null;
  if (!r) return missing();
  if (!rest || rest === "/") {
    const { filter, town, nearMe } = regionFilter(url, r.slug);
    const [events, source] = await Promise.all([listEvents(db, r, filter, now),
      filter.sourceId ? db.prepare("SELECT name FROM sources WHERE id = ? AND status = 'active'").bind(filter.sourceId).first<{ name: string }>() : Promise.resolve(null)]);
    // A position is the visitor's own: such a page is never kept in a shared cache.
    return html(regionPage(env, origin, { region: r, filter, town, nearMe, events, nowMs: now, sourceName: source?.name ?? null, sourceId: source ? filter.sourceId ?? null : null }),
      200, nearMe ? { "cache-control": "private, no-store" } : {});
  }
  if (rest === "/arrangorer") return html(organizersPage(env, origin, r, await organizers(db, r, now)));
  const eventMatch = /^\/e\/(\d{1,12})(?:-[a-z0-9-]*)?$/.exec(rest);
  if (eventMatch) {
    const event = await eventById(db, Number(eventMatch[1]));
    if (!event || event.hidden || event.region !== r.slug || !inRegion(r, event)) return missing();
    const canonical = eventPath(r.slug, event);
    if (url.pathname !== canonical) return new Response(null, { status: 301, headers: { location: canonical } });
    return html(eventPage(env, origin, r, event, now));
  }
  return missing();
}

