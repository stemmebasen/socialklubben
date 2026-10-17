import type { D1Database } from "./db.js";
import { zonedMs } from "./feed.js";
import { distanceKm, type Region } from "./geo.js";
import { WINDOW_DAYS } from "./sources.js";

/** What the portal shows: the coming events of active organizers in a region, filtered by when, theme
 * and distance. Every organizer's events are listed the same way - by time, never by who arranges them. */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const ZONE = "Europe/Copenhagen";

export type When = "idag" | "weekend" | "uge" | "maaned" | "alle";
export const WHEN: Array<{ slug: When; label: string }> = [
  { slug: "idag", label: "I dag" }, { slug: "weekend", label: "Weekend" }, { slug: "uge", label: "7 dage" }, { slug: "maaned", label: "30 dage" }, { slug: "alle", label: "Alle" }];
export const isWhen = (value: string | null): value is When => WHEN.some(w => w.slug === value);

export type ShownEvent = {
  id: number; title: string; starts_at_ms: number; ends_at_ms: number | null; all_day: number; online: number; location: string | null; description: string | null;
  link: string | null; image_url: string | null; topic: string; price_minor: number | null; source_id: number; source_name: string; source_website: string | null;
  venue_address: string | null; lat: number | null; lng: number | null; distance: number | null;
};

const parts = (ms: number) => Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: ZONE, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" })
  .formatToParts(ms).map(p => [p.type, p.value]));

/** Midnight in Copenhagen, `days` days after the day of `ms`. */
export function copenhagenMidnight(ms: number, days = 0): number {
  const p = parts(ms);
  const date = new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day) + days));
  return zonedMs(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), 0, 0, 0, ZONE);
}

/** The time window a "when" means, in Copenhagen time. The weekend runs from Friday 16 to Sunday night. */
export function window(when: When, nowMs: number): { from: number; to: number } {
  if (when === "idag") return { from: nowMs, to: copenhagenMidnight(nowMs, 1) };
  if (when === "uge") return { from: nowMs, to: nowMs + 7 * DAY };
  if (when === "alle") return { from: nowMs, to: nowMs + WINDOW_DAYS * DAY };
  if (when === "maaned") return { from: nowMs, to: nowMs + 30 * DAY };
  const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(parts(nowMs).weekday!);
  const untilFriday = (4 - weekday + 7) % 7;
  const weekendStart = weekday >= 5 ? nowMs : copenhagenMidnight(nowMs, untilFriday) + 16 * HOUR;
  const sundayEnd = copenhagenMidnight(nowMs, 7 - weekday);
  return { from: Math.max(nowMs, weekendStart), to: sundayEnd };
}

const SELECT = `SELECT e.id, e.title, e.starts_at_ms, e.ends_at_ms, e.all_day, e.online, e.location, e.description, e.link, e.image_url, e.topic, e.price_minor,
  s.id AS source_id, s.name AS source_name, s.website AS source_website, v.address AS venue_address, v.lat, v.lng
  FROM events e JOIN sources s ON s.id = e.source_id LEFT JOIN venues v ON v.id = e.venue_id`;

export type Filter = { when: When; topic: string | null; center: { lat: number; lng: number } | null; km: number | null; sourceId?: number | null };

export async function listEvents(db: D1Database, region: Region, filter: Filter, nowMs: number): Promise<ShownEvent[]> {
  const { from, to } = window(filter.when, nowMs);
  return listBetween(db, region, { from, to, topic: filter.topic, sourceId: filter.sourceId ?? null, center: filter.center, km: filter.km });
}

export type Range = { from: number; to: number; topic?: string | null; sourceId?: number | null; center?: { lat: number; lng: number } | null; km?: number | null; query?: string | null; ids?: number[] };

/** The shown events that are on at some point between `from` and `to` - the one query every view uses
 * (Udforsk, Planlæg, Søg, Gemt), so the rules for what is shown live in one place. */
export async function listBetween(db: D1Database, region: Region, range: Range): Promise<ShownEvent[]> {
  const where: string[] = [], values: unknown[] = [];
  if (range.topic) { where.push("e.topic = ?"); values.push(range.topic); }
  if (range.sourceId) { where.push("e.source_id = ?"); values.push(range.sourceId); }
  if (range.ids) { where.push(`e.id IN (${range.ids.map(() => "?").join(",") || "NULL"})`); values.push(...range.ids); }
  const words = (range.query ?? "").toLocaleLowerCase("da-DK").split(/\s+/).map(w => w.replace(/[%_\\]/g, "")).filter(w => w.length >= 2).slice(0, 5);
  for (const word of words) {
    // Every word somewhere: the title, the text, the organizer or the place.
    where.push("LOWER(e.title || ' ' || COALESCE(e.description, '') || ' ' || s.name || ' ' || COALESCE(e.location, '') || ' ' || COALESCE(v.address, '')) LIKE ?");
    values.push(`%${word}%`);
  }
  const rows = await db.prepare(`${SELECT} WHERE s.status = 'active' AND s.region = ? AND e.hidden = 0 AND e.removed_at_ms IS NULL
      AND COALESCE(e.ends_at_ms, e.starts_at_ms + ?) >= ? AND e.starts_at_ms < ? ${where.map(w => `AND ${w}`).join(" ")}
      ORDER BY e.starts_at_ms, e.id LIMIT 600`)
    .bind(region.slug, 3 * HOUR, range.from, range.to, ...values).all<Omit<ShownEvent, "distance">>();
  const shown: ShownEvent[] = [];
  for (const row of rows.results ?? []) {
    const placed = row.lat !== null && row.lng !== null ? { lat: row.lat, lng: row.lng } : null;
    // A place found far outside the region belongs to another region's portal.
    if (placed && distanceKm(region, placed) > region.radiusKm) continue;
    const distance = range.center && placed ? distanceKm(range.center, placed) : null;
    // With a radius chosen, only events with a known place within it - online events have no distance.
    if (range.center && range.km && (distance === null || distance > range.km)) continue;
    shown.push({ ...row, distance });
  }
  return shown;
}

/** A series is the same title from the same organizer: shown once, with how many more dates it has. */
export const seriesKey = (e: Pick<ShownEvent, "source_id" | "title">) => `${e.source_id}:${e.title.trim().toLocaleLowerCase("da-DK")}`;

export function firstOfSeries<T extends Pick<ShownEvent, "source_id" | "title">>(events: T[]): Array<T & { more: number }> {
  const first = new Map<string, T & { more: number }>();
  for (const e of events) {
    const key = seriesKey(e);
    const seen = first.get(key);
    if (seen) seen.more++;
    else first.set(key, { ...e, more: 0 });
  }
  return [...first.values()];
}

export async function eventById(db: D1Database, id: number): Promise<(Omit<ShownEvent, "distance"> & { region: string; removed_at_ms: number | null; hidden: number }) | null> {
  return db.prepare(`${SELECT.replace("SELECT ", "SELECT s.region, e.removed_at_ms, e.hidden, ")} WHERE e.id = ? AND s.status = 'active'`).bind(id)
    .first<Omit<ShownEvent, "distance"> & { region: string; removed_at_ms: number | null; hidden: number }>();
}

export type Organizer = { id: number; name: string; website: string | null; coming: number };

export async function organizers(db: D1Database, region: Region, nowMs: number): Promise<Organizer[]> {
  const rows = await db.prepare(`SELECT s.id, s.name, s.website, (SELECT COUNT(*) FROM events e WHERE e.source_id = s.id AND e.hidden = 0 AND e.removed_at_ms IS NULL
      AND COALESCE(e.ends_at_ms, e.starts_at_ms + ?) >= ?) AS coming FROM sources s WHERE s.status = 'active' AND s.region = ? ORDER BY s.name COLLATE NOCASE`)
    .bind(3 * HOUR, nowMs, region.slug).all<Organizer>();
  return rows.results ?? [];
}

export const copenhagenDay = (ms: number) => new Intl.DateTimeFormat("sv-SE", { timeZone: ZONE }).format(ms);

/** Where a click on an event goes - the event's own page, else the organizer's site - counted per day. */
export async function outboundLink(db: D1Database, eventId: number, nowMs: number): Promise<string | null> {
  const row = await db.prepare("SELECT e.source_id, e.link, s.website FROM events e JOIN sources s ON s.id = e.source_id WHERE e.id = ?").bind(eventId)
    .first<{ source_id: number; link: string | null; website: string | null }>();
  const to = row?.link || row?.website;
  if (!row || !to) return null;
  await db.prepare("INSERT INTO clicks (day, source_id, event_id, n) VALUES (?, ?, ?, 1) ON CONFLICT(day, source_id, event_id) DO UPDATE SET n = n + 1")
    .bind(copenhagenDay(nowMs), row.source_id, eventId).run().catch(() => undefined);
  return to;
}
