import type { ShownEvent } from "../events.js";
import { formatKm } from "../geo.js";
import { formatKrMinor } from "../price.js";
import { topicLabel } from "../topics.js";
import { clock, esc } from "./layout.js";

/** The small shared pieces of the public views: a glyph and a colour per theme (so a pin, a card and a
 * row can be told apart at a glance), the plain icons, and the event row Planlæg, Søg and Gemt share.
 * The colours are muted and few - ink pins with a coloured glyph - so the site stays calm, not festive. */

const ICON: Record<string, string> = {
  "mental-sundhed": `<path d="M4 5h16v11H9l-5 4z"/><path d="M9 10.5h6"/>`,
  udvikling: `<path d="M4 5c3-1 6-1 8 1 2-2 5-2 8-1v13c-3-1-6-1-8 1-2-2-5-2-8-1z"/><path d="M12 6v13"/>`,
  krop: `<circle cx="12" cy="4.5" r="2"/><path d="M5 9l7 1 7-1M12 10v5l-4 6M12 15l4 6"/>`,
  meditation: `<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14z"/><path d="M5 19l8-8"/>`,
  lyd: `<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>`,
  cirkler: `<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M15 14.5c3 0 6 2 6 5"/>`,
  spiritualitet: `<path d="M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 2-7 2 1 3 3 3 5 1-2 1-6 1-9z"/>`,
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

/** Each theme's colour as a CSS variable, light and dark. */
export const THEME_STYLE = `
:root{--t-mental-sundhed:#2446d8;--t-udvikling:#4b5a6e;--t-krop:#1d7a4d;--t-meditation:#2f6690;--t-lyd:#b45f06;--t-cirkler:#b8452f;--t-spiritualitet:#8a6d00}
@media (prefers-color-scheme:dark){:root{--t-mental-sundhed:#8ea2ff;--t-udvikling:#a9b4c4;--t-krop:#5fcf95;--t-meditation:#79b3dd;--t-lyd:#f2a54a;--t-cirkler:#f08a72;--t-spiritualitet:#d9b84a}}
[data-t]{--t:var(--accent)}${["mental-sundhed", "udvikling", "krop", "meditation", "lyd", "cirkler", "spiritualitet"].map(t => `[data-t="${t}"]{--t:var(--t-${t})}`).join("")}`;

const WEEKDAY_SHORT = new Intl.DateTimeFormat("da-DK", { timeZone: "Europe/Copenhagen", weekday: "short" });
/** "TORS. 19.00", "HELE DAGEN". */
export const shortWhen = (e: Pick<ShownEvent, "starts_at_ms" | "all_day">) =>
  `${WEEKDAY_SHORT.format(e.starts_at_ms).replace(/\.?$/, ".")} ${e.all_day ? "hele dagen" : clock(e.starts_at_ms)}`;

export const priceText = (minor: number | null) => minor === null ? null : minor === 0 ? "Gratis" : formatKrMinor(minor);

/** One row of a list: the theme's tile, "TEMA · TORS. 19.00" with any more dates of the series, the title,
 * and where - with the distance when a centre is chosen. */
export function eventRow(e: ShownEvent & { more?: number }, href: string, place: string | null): string {
  const where = [place ?? e.source_name, e.distance !== null ? formatKm(e.distance) : null].filter(Boolean).map(esc).join(" · ");
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
.row-where{font-size:14.5px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.day-head{margin:22px 4px 8px;font-size:13px;font-weight:650;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}.day-head:first-child{margin-top:0}`;
