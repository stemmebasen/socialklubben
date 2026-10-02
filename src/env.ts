import type { D1Database } from "./db.js";

export interface Env {
  DB?: D1Database;
  ASSETS?: { fetch(request: Request): Promise<Response> };
  /** The portal's name (a working title until it is chosen) - the only place it is set. */
  SITE_NAME?: string;
  /** The one password for the portal's administration (a secret). Without it, no one gets in. */
  ADMIN_PASSWORD?: string;
  /** Contact for the geocoder's usage policy (OpenStreetMap Nominatim asks for one). */
  GEOCODER_CONTACT?: string;
  /** Map tiles; OpenStreetMap's own by default. */
  MAP_TILES?: string;
  MAP_ATTRIBUTION?: string;
  /** Where organizers send their calendar address (shown on the about page). */
  CONTACT_EMAIL?: string;
}

export interface Deps {
  fetcher: typeof fetch;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
}

export const siteName = (env: Env) => env.SITE_NAME?.trim() || "Eventportal";
