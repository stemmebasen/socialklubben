import type { D1Database } from "./db.js";
import type { Deps, Env } from "./env.js";

/** A place's coordinates from its address, found once and kept in venues for every later event there.
 * OpenStreetMap's Nominatim asks for at most one lookup a second, a contact and caching - so new places
 * are looked up a few at a time from the scheduled job, and an address that cannot be found is tried
 * at most three times. The administration can always set a place by hand. */

const MAX_PER_RUN = 8;
const MAX_ATTEMPTS = 3;

export const addressKey = (address: string) => address.toLocaleLowerCase("da-DK").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Online events have no place on the map. */
export const isOnline = (location: string | null) => !!location && /^(?:online|zoom|teams|google meet|livestream|virtuel|digital)\b/i.test(location.trim());

/** The address to look up: the event's own when it reads like an address (a number in it), else the
 * organizer's house. "Hjerterum" alone is a name, not an address. */
export function addressFor(location: string | null, defaultAddress: string | null): string | null {
  const own = location?.trim() ?? "";
  if (own && /\d/.test(own)) return own.slice(0, 200);
  return defaultAddress?.trim() || own || null;
}

export async function venueFor(db: D1Database, address: string | null): Promise<number | null> {
  if (!address) return null;
  const key = addressKey(address);
  if (!key) return null;
  await db.prepare("INSERT INTO venues (address_key, address) VALUES (?, ?) ON CONFLICT(address_key) DO NOTHING").bind(key, address).run();
  const row = await db.prepare("SELECT id FROM venues WHERE address_key = ?").bind(key).first<{ id: number }>();
  return row?.id ?? null;
}

export async function lookup(env: Env, deps: Deps, address: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=dk&q=${encodeURIComponent(address)}`;
  const response = await deps.fetcher(url, { signal: AbortSignal.timeout(10_000),
    headers: { accept: "application/json", "accept-language": "da", "user-agent": `${env.SITE_NAME?.trim() || "Socialklubben"} (${env.GEOCODER_CONTACT?.trim() || "kontakt ikke angivet"})` } });
  if (!response.ok) throw new Error(`geocoder_${response.status}`);
  const [hit] = await response.json() as Array<{ lat?: string; lon?: string }>;
  const lat = Number(hit?.lat), lng = Number(hit?.lon);
  return hit && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

/** Looks up a few new places; returns how many were found. */
export async function geocodePending(env: Env, deps: Deps): Promise<number> {
  const db = env.DB;
  if (!db) return 0;
  const pending = (await db.prepare("SELECT id, address FROM venues WHERE status = 'pending' OR (status = 'not_found' AND attempts < ?) ORDER BY attempts, id LIMIT ?")
    .bind(MAX_ATTEMPTS, MAX_PER_RUN).all<{ id: number; address: string }>()).results ?? [];
  let found = 0;
  for (const [i, venue] of pending.entries()) {
    if (i > 0) await deps.sleep(1100);
    let point: { lat: number; lng: number } | null = null;
    try { point = await lookup(env, deps, venue.address); }
    catch (error) { console.warn("geocode_failed", venue.id, error instanceof Error ? error.message : error); continue; }
    await db.prepare("UPDATE venues SET lat = ?, lng = ?, status = ?, attempts = attempts + 1, geocoded_at_ms = ? WHERE id = ? AND status <> 'manual'")
      .bind(point?.lat ?? null, point?.lng ?? null, point ? "found" : "not_found", deps.now(), venue.id).run();
    if (point) found++;
  }
  return found;
}

export async function setVenueByHand(db: D1Database, id: number, lat: number, lng: number, nowMs: number): Promise<boolean> {
  if (!(lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180)) return false;
  const result = await db.prepare("UPDATE venues SET lat = ?, lng = ?, status = 'manual', geocoded_at_ms = ? WHERE id = ?").bind(lat, lng, nowMs, id).run();
  return Number(result.meta?.changes ?? 0) === 1;
}

export async function retryVenue(db: D1Database, id: number): Promise<void> {
  await db.prepare("UPDATE venues SET status = 'pending', attempts = 0 WHERE id = ?").bind(id).run();
}
