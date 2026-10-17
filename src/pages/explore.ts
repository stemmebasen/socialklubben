import { siteName, type Env } from "../env.js";
import { copenhagenDay, copenhagenMidnight, type ShownEvent } from "../events.js";
import type { Region } from "../geo.js";
import { SHOWN_TOPICS, isTopic, topicLabel } from "../topics.js";
import { clock, esc, page, scriptJson } from "./layout.js";
import { eventPath, placeText } from "./region.js";
import { COLORS, icon, iconPaths, priceText } from "./ui.js";

/** Udforsk: the region on a map, with a sheet over it - the next 14 days as bars, the chosen day's events
 * as cards, and a few plain filters. The server draws all of it from the address, so it works without
 * JavaScript; /explore.js then follows the map, so the bars and cards count only what is in view. */

export const EXPLORE_DAYS = 14;
const HOUR = 3_600_000;

export type Kind = "alle" | "sted" | "online" | "gratis";
const KINDS: Array<[Kind, string]> = [["alle", "Alle"], ["sted", "Med adresse"], ["online", "Online"], ["gratis", "Gratis"]];
export type Length = "kort" | "halv" | "hel" | "flere";
const LENGTHS: Array<[Length, string]> = [["kort", "Op til 2½ time"], ["halv", "Op til en halv dag"], ["hel", "En hel dag"], ["flere", "Flere dage"]];

export type ExploreQuery = { day: string | null; topic: string | null; kind: Kind; length: Length | null };

export function exploreQuery(url: URL): ExploreQuery {
  const kind = url.searchParams.get("slags"), length = url.searchParams.get("varighed"), topic = url.searchParams.get("tema"), day = url.searchParams.get("dag");
  return { day: day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null, topic: topic && isTopic(topic) ? topic : null,
    kind: KINDS.some(([k]) => k === kind) ? kind as Kind : "alle", length: LENGTHS.some(([l]) => l === length) ? length as Length : null };
}

type Day = { key: string; start: number; end: number; letter: string; date: number; label: string };

const LETTER = new Intl.DateTimeFormat("da-DK", { timeZone: "Europe/Copenhagen", weekday: "narrow" });
const SHORT = new Intl.DateTimeFormat("da-DK", { timeZone: "Europe/Copenhagen", weekday: "short" });

export function exploreDays(nowMs: number): Day[] {
  return Array.from({ length: EXPLORE_DAYS }, (_, i) => {
    const start = copenhagenMidnight(nowMs, i), end = copenhagenMidnight(nowMs, i + 1), noon = start + 12 * HOUR;
    const date = Number(copenhagenDay(noon).slice(8));
    return { key: copenhagenDay(noon), start, end, letter: LETTER.format(noon).toLocaleUpperCase("da-DK"), date,
      label: i === 0 ? "I dag" : i === 1 ? "I morgen" : `${SHORT.format(noon).replace(/\.$/, "")}. ${date}.` };
  });
}

/** How long an event lasts - only when its calendar says when it ends; nothing is guessed. */
export function lengthOf(e: Pick<ShownEvent, "starts_at_ms" | "ends_at_ms" | "all_day">): Length | null {
  if (e.ends_at_ms === null) return e.all_day ? "hel" : null;
  const hours = (e.ends_at_ms - e.starts_at_ms) / HOUR;
  if (hours > 24 || (e.all_day && hours > 24)) return "flere";
  if (e.all_day || hours > 5) return "hel";
  return hours > 2.5 ? "halv" : "kort";
}

/** The days (of the 14) an event is on: its first day, every day of a stay of several days, and today
 * for one already under way. */
function daysOf(e: ShownEvent, days: Day[]): number[] {
  const end = lengthOf(e) === "flere" ? e.ends_at_ms! - 1 : e.starts_at_ms;
  return days.flatMap((d, i) => e.starts_at_ms < d.end && end >= d.start ? [i] : i === 0 && e.starts_at_ms < d.start && (e.ends_at_ms ?? e.starts_at_ms + 3 * HOUR) > d.start ? [0] : []);
}

const matches = (e: ShownEvent, q: ExploreQuery) =>
  (!q.topic || e.topic === q.topic) && (q.kind === "alle" || (q.kind === "online" ? e.online === 1 : q.kind === "gratis" ? e.price_minor === 0 : e.online === 0 && e.lat !== null))
  && (!q.length || lengthOf(e) === q.length);

const STYLE = `
body.explore-page{overflow:hidden;height:100dvh}
body.explore-page header.bar{position:fixed;left:0;right:0}
.explore{position:fixed;inset:0;display:block;max-width:none;padding:0}
.map-pane{position:absolute;inset:0;background:var(--soft)}#map{position:absolute;inset:0}
@media (prefers-color-scheme:dark){.leaflet-tile-pane{filter:invert(1) hue-rotate(180deg) brightness(.82) contrast(.9) saturate(.6)}.leaflet-container{background:#1b222c}}
.leaflet-control-attribution{font:11px var(--font);background:color-mix(in srgb,var(--card) 70%,transparent)!important}
.pin{position:relative;width:44px;height:44px;border-radius:50% 50% 50% 8px;transform:rotate(-45deg);background:#1d2733;box-shadow:0 6px 16px -6px rgba(0,0,0,.55),0 0 0 1.5px rgba(255,255,255,.14) inset;display:grid;place-items:center;transition:transform .15s}
.pin svg{transform:rotate(45deg);color:var(--t)}.pin b{position:absolute;top:-6px;right:-8px;transform:rotate(45deg);min-width:22px;height:22px;padding:0 6px;border-radius:11px;background:#fff;color:#16202e;font:700 12.5px/22px var(--font);text-align:center;box-shadow:0 2px 6px rgba(0,0,0,.25)}
.pin.on{transform:rotate(-45deg) scale(1.18)}
${Object.entries(COLORS).map(([t, [, dark]]) => `.pin[data-t="${t}"]{--t:${dark}}`).join("")}
.deck{position:absolute;z-index:900;display:flex;gap:10px;scrollbar-width:none}
.deck::-webkit-scrollbar{display:none}
.sheet,.ev-card,.empty-card{background:color-mix(in srgb,var(--card) 94%,transparent);backdrop-filter:blur(18px) saturate(1.3);-webkit-backdrop-filter:blur(18px) saturate(1.3);border-radius:26px;box-shadow:0 18px 40px -18px rgba(10,16,26,.45);border:1px solid color-mix(in srgb,var(--line) 55%,transparent)}
@media (prefers-color-scheme:dark){.sheet,.ev-card,.empty-card{background:color-mix(in srgb,#06090d 90%,transparent)}}
.sheet{padding:18px 18px 14px;display:grid;gap:12px;align-content:start}
.sheet-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
.sheet h1{font-size:22px;letter-spacing:-.02em;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.seg{display:flex;gap:2px;padding:3px;border-radius:999px;background:var(--soft)}
.seg a{display:grid;place-items:center;width:36px;height:32px;border-radius:999px;color:var(--muted)}
.seg a.on{background:var(--card);color:var(--accent);box-shadow:var(--shadow)}
@media (prefers-color-scheme:dark){.seg{background:#1a222d}.seg a.on{background:#2a3441}}
.bars{display:grid;grid-template-columns:repeat(${EXPLORE_DAYS},1fr);gap:2px}
.dbar{display:grid;justify-items:center;gap:4px;padding:6px 0 4px;border-radius:12px;color:var(--ink);text-decoration:none;font-variant-numeric:tabular-nums}
.dbar .col{display:flex;align-items:flex-end;justify-content:center;width:100%;height:78px}
.dbar i{display:block;width:min(14px,70%);height:var(--h);min-height:4px;border-radius:5px;background:color-mix(in srgb,var(--accent) 30%,var(--soft))}
.dbar.zero i{background:var(--line)}
.dbar b{font-size:11.5px;font-weight:600;color:var(--faint)}.dbar span{font-size:13.5px;font-weight:600;letter-spacing:-.02em}
.dbar.today span{color:var(--accent);text-decoration:underline;text-underline-offset:4px;text-decoration-thickness:2px}
.dbar.on{background:color-mix(in srgb,var(--accent) 12%,transparent)}.dbar.on i{background:var(--accent)}.dbar.on span{color:var(--accent)}
.dayline{display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:16.5px}#daytext{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dayline .n{color:var(--muted)}
.dur{position:relative}.dur summary{list-style:none;cursor:pointer;color:var(--accent);font-weight:600;white-space:nowrap}.dur summary::-webkit-details-marker{display:none}
.dur[open] div{position:absolute;right:0;bottom:calc(100% + 8px);z-index:5;display:grid;min-width:210px;padding:6px;border-radius:16px;background:var(--card);box-shadow:0 18px 40px -12px rgba(10,16,26,.4);border:1px solid var(--line)}
.dur div a{padding:9px 12px;border-radius:10px;color:var(--ink);text-decoration:none;font-size:15px}.dur div a.on{color:var(--accent);font-weight:650;background:var(--tint)}
.sheet .chips{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;margin:0 -18px;padding:0 18px 2px}.sheet .chips::-webkit-scrollbar{display:none}
.sheet .chips a{box-shadow:none;background:var(--soft);gap:7px}.sheet .chips a::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--t)}
.sheet .chips a.all::before{display:none}.sheet .chips a.on{background:var(--ink);color:var(--bg)}
@media (prefers-color-scheme:dark){.sheet .chips a{background:#1a222d}.sheet .chips a.on{background:var(--ink);color:#06090d}}
.ev-card{position:relative;display:grid;grid-template-rows:118px 1fr;overflow:hidden;color:var(--ink);text-decoration:none}
.ev-card .cover{display:grid;place-items:center;background:color-mix(in srgb,var(--t) 18%,var(--card));color:var(--t);background-size:cover;background-position:center}
.ev-card .cover.img{color:transparent}
.ev-card .badge{position:absolute;top:12px;left:12px;padding:4px 10px;border-radius:9px;background:var(--t);color:#fff;font-size:11.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
@media (prefers-color-scheme:dark){.ev-card .badge{color:#06090d}}
.ev-card .body{padding:12px 16px 14px;display:grid;align-content:start;gap:4px}
.ev-card h2{margin:0;font-size:17px;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ev-card h2 a{color:inherit;text-decoration:none}.ev-card h2 a::after{content:"";position:absolute;inset:0}
.ev-card p{margin:0;color:var(--muted);font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ev-card .when{color:var(--t);font-weight:650}
.ev-card.on{outline:2px solid var(--accent);outline-offset:-2px}
.save{position:absolute;z-index:2;top:10px;right:10px;width:38px;height:38px;min-height:0;padding:0;border-radius:50%;background:color-mix(in srgb,var(--card) 82%,transparent);color:var(--ink);backdrop-filter:blur(8px)}
.save[aria-pressed="true"]{color:var(--accent)}.save[aria-pressed="true"] svg{fill:currentColor}
.empty-card{display:grid;place-items:center;padding:20px;text-align:center;color:var(--muted)}
.locate{position:absolute;z-index:900;right:16px;top:76px;width:46px;height:46px;min-height:0;padding:0;border-radius:50%;background:var(--card);color:var(--accent);box-shadow:var(--shadow)}
@media (min-width:721px){
.explore{top:0}.map-pane{left:448px}
.deck{top:84px;left:16px;bottom:16px;width:416px;flex-direction:column;overflow-y:auto;padding-bottom:8px}
.sheet{flex:none}.ev-card{flex:none;grid-template-columns:132px 1fr;grid-template-rows:auto;min-height:132px}.ev-card .body{padding-right:54px}.ev-card .badge{top:auto;bottom:10px;left:10px;max-width:112px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;letter-spacing:.04em}.empty-card{flex:none;min-height:120px}
.leaflet-left{left:0}}
@media (max-width:720px){
.deck{left:0;right:0;bottom:calc(68px + env(safe-area-inset-bottom));padding:0 16px 10px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-padding:0 16px}
.sheet{flex:none;width:calc(100vw - 52px);scroll-snap-align:start}.ev-card,.empty-card{flex:none;width:236px;scroll-snap-align:start}
.leaflet-top.leaflet-right{top:128px}.leaflet-right .leaflet-control-zoom{margin-right:16px;border:0;box-shadow:var(--shadow)}}`;

/** The compact form the map script gets: only what it draws. */
function compact(region: Region, e: ShownEvent, days: Day[]) {
  return { id: e.id, t: e.title, k: e.topic, h: e.all_day ? "Hele dagen" : clock(e.starts_at_ms), w: placeText(e) ?? e.source_name, n: e.source_name,
    la: e.lat, ln: e.lng, o: e.online, p: e.price_minor, v: lengthOf(e), d: daysOf(e, days), u: eventPath(region.slug, e), i: e.image_url };
}

type Compact = ReturnType<typeof compact>;

function card(e: Compact, day: Day): string {
  const price = priceText(e.p);
  return `<article class="ev-card" data-t="${esc(e.k)}" data-id="${e.id}"><div class="cover${e.i ? " img" : ""}"${e.i ? ` style="background-image:url('${esc(e.i.replace(/'/g, "%27"))}')"` : ""}>${icon(e.k, 40)}</div>
<span class="badge">${esc(topicLabel(e.k))}</span><button type="button" class="save" data-save="${e.id}" aria-pressed="false" aria-label="Gem" hidden>${icon("gemt", 18)}</button>
<div class="body"><h2><a href="${esc(e.u)}">${esc(e.t)}</a></h2><p><span class="when">${esc(day.label)} ${esc(e.h)}</span></p><p>${esc(e.w)}${price ? ` · ${esc(price)}` : ""}</p></div></article>`;
}

export function explorePage(env: Env, origin: string, region: Region, events: ShownEvent[], q: ExploreQuery, nowMs: number): string {
  const days = exploreDays(nowMs);
  const chosen = Math.max(0, days.findIndex(d => d.key === q.day));
  const all = events.map(e => compact(region, e, days)).filter(e => e.d.length);
  const shown = events.filter(e => matches(e, q)).map(e => compact(region, e, days)).filter(e => e.d.length);
  const counts = days.map((_, i) => shown.filter(e => e.d.includes(i)).length);
  const max = Math.max(1, ...counts);
  const day = days[chosen]!;
  const today = shown.filter(e => e.d.includes(chosen));

  const href = (change: Partial<Record<"dag" | "tema" | "slags" | "varighed", string | null>>) => {
    const p = new URLSearchParams();
    const base = { dag: chosen ? day.key : null, tema: q.topic, slags: q.kind === "alle" ? null : q.kind, varighed: q.length, ...change };
    for (const [k, v] of Object.entries(base)) if (v) p.set(k, v);
    return `/${region.slug}${p.size ? `?${p}` : ""}`;
  };
  const seg = KINDS.map(([k, label]) => `<a href="${esc(href({ slags: k === "alle" ? null : k }))}" data-slags="${k}" title="${esc(label)}" aria-label="${esc(label)}"${q.kind === k ? ' class="on" aria-current="true"' : ""}>${icon(k, 19)}</a>`).join("");
  const bars = days.map((d, i) => `<a class="dbar${i === chosen ? " on" : ""}${i === 0 ? " today" : ""}${counts[i] ? "" : " zero"}" href="${esc(href({ dag: i ? d.key : null }))}" data-day="${i}" aria-label="${esc(d.label)}: ${counts[i]} events"${i === chosen ? ' aria-current="date"' : ""}>
<span class="col"><i style="--h:${Math.round((counts[i]! / max) * 100)}%"></i></span><b>${esc(d.letter)}</b><span>${d.date}</span></a>`).join("");
  const lengths = `<details class="dur"><summary>${esc(q.length ? LENGTHS.find(([l]) => l === q.length)![1] : "Hvor længe?")} ›</summary><div>
<a href="${esc(href({ varighed: null }))}" data-varighed=""${q.length ? "" : ' class="on"'}>Alle længder</a>${LENGTHS.map(([l, label]) => `<a href="${esc(href({ varighed: l }))}" data-varighed="${l}"${q.length === l ? ' class="on"' : ""}>${esc(label)}</a>`).join("")}</div></details>`;
  const chips = `<a class="all${q.topic ? "" : " on"}" href="${esc(href({ tema: null }))}" data-tema="">Alle kategorier</a>${SHOWN_TOPICS.map(t => `<a data-t="${t.slug}" data-tema="${t.slug}" href="${esc(href({ tema: t.slug }))}"${q.topic === t.slug ? ' class="on"' : ""}>${esc(t.label)}</a>`).join("")}`;
  const cards = today.length ? today.map(e => card(e, day)).join("") : `<div class="empty-card"><p>Ingen events ${esc(day.label.toLocaleLowerCase("da-DK"))} med de valg.</p></div>`;

  const data = { region: { name: region.name, lat: region.lat, lng: region.lng }, towns: region.towns.map(t => ({ n: t.name, la: t.lat, ln: t.lng })),
    days: days.map(d => ({ key: d.key, letter: d.letter, date: d.date, label: d.label })), events: all, chosen,
    tiles: env.MAP_TILES || "https://tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: env.MAP_ATTRIBUTION || "© OpenStreetMap",
    labels: Object.fromEntries(SHOWN_TOPICS.map(t => [t.slug, t.label])), icons: iconPaths([...SHOWN_TOPICS.map(t => t.slug), "gemt"]) };

  return page(env, origin, { title: `Det sker i ${region.name} · ${siteName(env)}`, path: `/${region.slug}`, section: "udforsk", regionSlug: region.slug, regionName: region.name,
    description: `Koncerter, teater, udstillinger, foredrag, fællesspisning og meget mere i ${region.name} - på et kort, dag for dag.`,
    bodyClass: "explore-page", noFooter: true, head: `<link rel="stylesheet" href="/vendor/leaflet/leaflet.css"><style>${STYLE}</style>`,
    scripts: ["/vendor/leaflet/leaflet.js", "/explore.js"],
    body: `<main class="explore"><div class="map-pane"><div id="map" aria-label="Kort over events"></div></div>
<button type="button" class="locate" id="locate" aria-label="Vis hvor jeg er" hidden>${icon("udforsk", 20)}</button>
<div class="deck" id="deck"><section class="sheet" aria-label="Overblik"><div class="sheet-head"><h1 id="area">${esc(region.name)}</h1><nav class="seg" aria-label="Slags">${seg}</nav></div>
<nav class="bars" aria-label="De næste 14 dage">${bars}</nav>
<div class="dayline"><span id="daytext"><b>${esc(day.label)}</b> <span class="n">· ${today.length} event${today.length === 1 ? "" : "s"}</span></span>${lengths}</div>
<nav class="chips" aria-label="Kategori">${chips}</nav></section><div id="cards" style="display:contents">${cards}</div></div>
<script type="application/json" id="explore-data">${scriptJson(data)}</script></main>` });
}
