import type { ShownEvent } from "../events.js";
import { formatKm } from "../geo.js";
import { formatKrMinor } from "../price.js";
import { topicLabel } from "../topics.js";
import { clock, esc } from "./layout.js";
import { placeAddress, placeName } from "./region.js";

/** The small shared pieces of the public views: a glyph and a colour per theme (so a pin, a card and a
 * row can be told apart at a glance), the plain icons, and the event row Planlæg, Søg and Gemt share.
 * The colours are muted and few - ink pins with a coloured glyph - so the site stays calm, not festive. */

const ICON: Record<string, string> = {
  musik: `<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>`,
  scene: `<path d="M4 6h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4z"/><path d="M14 6v2M14 11v2M14 16v2"/>`,
  film: `<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9.5h4M17 9.5h4M3 14.5h4M17 14.5h4"/>`,
  kunst: `<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 16l5-5 4 4 3-3 6 6"/><circle cx="15.5" cy="8.5" r="1.5"/>`,
  foredrag: `<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/>`,
  litteratur: `<path d="M4 5c3-1 6-1 8 1 2-2 5-2 8-1v13c-3-1-6-1-8 1-2-2-5-2-8-1z"/><path d="M12 6v13"/>`,
  mad: `<path d="M7 3v8a2 2 0 0 0 2 2v8M5 3v5a2 2 0 0 0 2 2M9 3v5a2 2 0 0 1-2 2M17 21V3c-2 1-3 4-3 8h3"/>`,
  "krop-sind": `<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14z"/><path d="M5 19l8-8"/>`,
  sport: `<circle cx="12" cy="4.5" r="2"/><path d="M5 9l7 1 7-1M12 10v5l-4 6M12 15l4 6"/>`,
  workshops: `<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>`,
  faellesskab: `<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M15 14.5c3 0 6 2 6 5"/>`,
  marked: `<path d="M3 9l2-5h14l2 5"/><path d="M3 9h18v1a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z"/><path d="M5 13v7h14v-7"/>`,
  natteliv: `<path d="M5 4h14l-7 8z"/><path d="M12 12v8M8 20h8"/>`,
  alle: `<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>`,
  sted: `<path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>`,
  online: `<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>`,
  gratis: `<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>`,
  udforsk: `<path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>`,
  planlaeg: `<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4M8 14h2M14 14h2M8 17.5h2"/>`,
  gemt: `<path d="M6 3h12v18l-6-4-6 4z"/>`,
  sog: `<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>`,
  filter: `<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>`,
  pil: `<path d="M9 5l7 7-7 7"/>`
};

export const icon = (name: string, size = 20) =>
  `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name] ?? ICON.alle}</svg>`;

/** The glyph's inner markup, for the map script to draw pins with. */
export const iconPaths = (names: string[]) => Object.fromEntries(names.map(n => [n, ICON[n] ?? ICON.alle!]));

/** Each category's colour, for a light and a dark page. Pins are ink in both, so they use the dark one. */
export const COLORS: Record<string, [string, string]> = {
  musik: ["#b45f06", "#f2a54a"], scene: ["#b8452f", "#f08a72"], film: ["#4b5a6e", "#c3ccd8"], kunst: ["#8a3f72", "#e08cc6"], foredrag: ["#2446d8", "#8ea2ff"],
  litteratur: ["#7a5c3a", "#d6b48c"], mad: ["#8a6d00", "#e3c35a"], "krop-sind": ["#2f6690", "#79b3dd"], sport: ["#1d7a4d", "#5fcf95"], workshops: ["#0f6f6f", "#5fd0cf"],
  faellesskab: ["#b23a5b", "#f08aa6"], marked: ["#5a7a1d", "#a9d65f"], natteliv: ["#5b3fb8", "#a993ff"]
};

export const THEME_STYLE = `
:root{${Object.entries(COLORS).map(([t, [light]]) => `--t-${t}:${light}`).join(";")}}
@media (prefers-color-scheme:dark){:root{${Object.entries(COLORS).map(([t, [, dark]]) => `--t-${t}:${dark}`).join(";")}}}
[data-t]{--t:var(--accent)}${Object.keys(COLORS).map(t => `[data-t="${t}"]{--t:var(--t-${t})}`).join("")}`;

const WEEKDAY_SHORT = new Intl.DateTimeFormat("da-DK", { timeZone: "Europe/Copenhagen", weekday: "short" });
/** "TORS. 19.00", "HELE DAGEN". */
export const shortWhen = (e: Pick<ShownEvent, "starts_at_ms" | "all_day">) =>
  `${WEEKDAY_SHORT.format(e.starts_at_ms).replace(/\.?$/, ".")} ${e.all_day ? "hele dagen" : clock(e.starts_at_ms)}`;

export const priceText = (minor: number | null) => minor === null ? null : minor === 0 ? "Gratis" : formatKrMinor(minor);

/** One row of a list: the category's tile, "TORS. 19.00 · KATEGORI" with any more dates of the series, the
 * title, and where - the place's or organizer's name first, then the address and the distance when a centre is chosen. */
export function eventRow(e: ShownEvent & { more?: number }, href: string): string {
  const address = placeAddress(e);
  const where = `<b>${esc(placeName(e))}</b>${[address, e.distance !== null ? formatKm(e.distance) : null].filter(Boolean).map(t => ` · ${esc(t)}`).join("")}`;
  const price = priceText(e.price_minor);
  return `<li><a class="row" href="${esc(href)}" data-t="${esc(e.topic)}"><span class="tile">${icon(e.topic, 24)}</span><span class="row-main">
<span class="kicker"><span>${esc(shortWhen(e))} · ${esc(topicLabel(e.topic))}</span>${e.more ? `<span class="more">+${e.more} ${e.more === 1 ? "dato" : "datoer"}</span>` : ""}</span>
<span class="row-title">${esc(e.title)}</span><span class="row-where">${where}${price ? ` · ${esc(price)}` : ""}</span></span>${icon("pil", 18)}</a></li>`;
}

export const ROW_STYLE = `
.rows{list-style:none;margin:0;padding:0;background:var(--card);border-radius:var(--radius);box-shadow:var(--shadow);border:1px solid color-mix(in srgb,var(--line) 60%,transparent);overflow:hidden}
.rows li+li .row-main{border-top:1px solid var(--line)}
.row{display:grid;grid-template-columns:52px minmax(0,1fr) 18px;gap:14px;align-items:center;padding:0 16px 0 14px;color:var(--ink);text-decoration:none}
.row:hover .row-title{color:var(--accent)}.row>.ico{color:var(--faint)}
.tile{width:52px;height:52px;border-radius:14px;display:grid;place-items:center;color:var(--t);background:color-mix(in srgb,var(--t) 13%,transparent)}
.row-main{display:grid;gap:1px;padding:14px 0;min-width:0}
.kicker{display:flex;align-items:center;gap:8px;min-width:0;font-size:12.5px;font-weight:650;letter-spacing:.06em;text-transform:uppercase;color:var(--t)}
.kicker>span:first-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.more{flex:none;padding:1px 8px;border-radius:7px;background:color-mix(in srgb,var(--t) 14%,transparent);letter-spacing:.02em;text-transform:none}
.row-title{font-size:17px;font-weight:650;line-height:1.3;letter-spacing:-.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.row-where b{color:var(--ink);font-weight:600}.row-where{font-size:14.5px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.day-head{margin:22px 4px 8px;font-size:13px;font-weight:650;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}.day-head:first-child{margin-top:0}`;
