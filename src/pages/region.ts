import { siteName, type Env } from "../env.js";
import { WHEN, type Filter, type ShownEvent, type When } from "../events.js";
import { formatKm, RADII, type Region, type Town } from "../geo.js";
import { formatKrMinor } from "../price.js";
import { SHOWN_TOPICS, topicLabel } from "../topics.js";
import { clock, dayLabel, esc, page, scriptJson, slug } from "./layout.js";

/** A region's calendar: the filters, the list by day and the map with the chosen radius. Everything is in
 * the address (shareable, and it works without JavaScript); the map is drawn on top by /map.js. */

const STYLE = `
.hero{display:grid;gap:4px}
.filters{display:grid;gap:12px}.place{display:flex;gap:8px;flex-wrap:wrap;align-items:end}.place label{flex:1 1 180px}.place .km{flex:0 1 130px}.place button{flex:none}
.layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(320px,42%);gap:24px;align-items:start}
.map-wrap{position:sticky;top:76px;height:calc(100vh - 100px);min-height:420px;border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow);border:1px solid color-mix(in srgb,var(--line) 60%,transparent);background:var(--soft)}
#map{position:absolute;inset:0}.map-wrap noscript{display:grid;place-items:center;height:100%;color:var(--muted);padding:20px;text-align:center}
.count{margin:0;color:var(--muted);font-size:15px}.days{display:grid;gap:16px}
.day h2{margin:0 0 4px}.day .ev:last-child{padding-bottom:0}.ev{display:grid;grid-template-columns:64px minmax(0,1fr);gap:14px;padding:14px 0;border-top:1px solid var(--line)}
.day h2+.ev{border-top:0}.ev-time b{display:block;font-size:17px;font-weight:650;letter-spacing:-.01em}.ev-time span{font-size:13px;color:var(--muted)}
.ev-title{font-weight:650;font-size:17px;line-height:1.3;color:var(--ink);text-decoration:none}.ev-title:hover{color:var(--accent)}
.ev-meta{margin:3px 0 7px;color:var(--muted);font-size:14.5px}.ev-tags{display:flex;gap:6px;flex-wrap:wrap;margin:0}
.leaflet-popup-content{font:14px/1.4 var(--font)}.leaflet-popup-content a{font-weight:650}.leaflet-popup-content p{margin:0 0 6px}
@media (max-width:900px){.layout{grid-template-columns:1fr}.map-wrap{position:relative;top:0;height:300px;min-height:0;order:-1}}
@media (max-width:720px){.filters .chips{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;margin:0 -16px;padding:4px 16px 8px}.filters .chips::-webkit-scrollbar{display:none}}`;

export type RegionView = { region: Region; filter: Filter; town: Town | null; nearMe: boolean; events: ShownEvent[]; nowMs: number; sourceName: string | null; sourceId: number | null };

const startOfDay = (ms: number) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Copenhagen" }).format(ms);

export function eventPath(region: string, event: { id: number; title: string }): string {
  return `/${region}/e/${event.id}-${slug(event.title)}`;
}

function heading(ms: number, nowMs: number): string {
  const day = startOfDay(ms), today = startOfDay(nowMs), tomorrow = startOfDay(nowMs + 86_400_000);
  const label = day === today ? "I dag" : day === tomorrow ? "I morgen" : dayLabel(ms);
  return label.charAt(0).toLocaleUpperCase("da-DK") + label.slice(1);
}

/** Where, as people say it: the address when the calendar gives one; a place name with its address; and
 * just the address when the place is the organizer itself ("Hjerterum" at Hjerterum). */
export function placeText(e: Pick<ShownEvent, "online" | "location" | "venue_address" | "source_name">): string | null {
  if (e.online) return "Online";
  const location = e.location?.trim() || null, address = e.venue_address;
  if (location && /\d/.test(location)) return location;
  if (location && address && location.toLocaleLowerCase("da-DK") !== e.source_name.toLocaleLowerCase("da-DK") && location !== address) return `${location}, ${address}`;
  return address ?? location;
}

function eventLine(region: string, e: ShownEvent, nowMs: number): string {
  const running = e.starts_at_ms < nowMs;
  const time = e.all_day ? `<b>Hele dagen</b>` : `<b>${esc(clock(e.starts_at_ms))}</b>${e.ends_at_ms ? `<span>–${esc(clock(e.ends_at_ms))}</span>` : ""}`;
  const meta = [e.source_name, placeText(e), e.distance !== null ? formatKm(e.distance) : null].filter(Boolean).map(esc).join(" · ");
  const price = e.price_minor === null ? "" : `<span class="pill dim">${e.price_minor === 0 ? "Gratis" : esc(formatKrMinor(e.price_minor))}</span>`;
  return `<article class="ev"><div class="ev-time">${time}</div><div><a class="ev-title" href="${esc(eventPath(region, e))}">${esc(e.title)}</a>
<p class="ev-meta">${meta}</p><p class="ev-tags"><span class="pill">${esc(topicLabel(e.topic))}</span>${e.online ? `<span class="pill dim">Online</span>` : ""}${price}${running ? `<span class="pill dim">I gang</span>` : ""}</p></div></article>`;
}

export function regionPage(env: Env, origin: string, v: RegionView): string {
  const r = v.region, f = v.filter;
  const params = (change: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const base: Record<string, string | null> = { nar: f.when === "maaned" ? null : f.when, tema: f.topic, by: v.town?.slug ?? (v.nearMe ? "naer" : null), km: f.km && f.center ? String(f.km) : null,
      lat: v.nearMe && f.center ? f.center.lat.toFixed(3) : null, lng: v.nearMe && f.center ? f.center.lng.toFixed(3) : null, arr: v.sourceId ? String(v.sourceId) : null };
    for (const [k, val] of Object.entries({ ...base, ...change })) if (val) p.set(k, val);
    const q = p.toString();
    return `/${r.slug}${q ? `?${q}` : ""}`;
  };
  const chip = (href: string, label: string, on: boolean) => `<a href="${esc(href)}"${on ? ' class="on" aria-current="true"' : ""}>${esc(label)}</a>`;
  const whenChips = WHEN.map(w => chip(params({ nar: w.slug === "maaned" ? null : w.slug }), w.label, f.when === w.slug)).join("");
  const topicChips = chip(params({ tema: null }), "Alle temaer", !f.topic) + SHOWN_TOPICS.map(t => chip(params({ tema: t.slug }), t.label, f.topic === t.slug)).join("");
  const keep = (name: string, value: string | null) => value ? `<input type="hidden" name="${name}" value="${esc(value)}">` : "";
  const place = `<form class="place" method="get" action="/${esc(r.slug)}">${keep("nar", f.when === "maaned" ? null : f.when)}${keep("tema", f.topic)}${keep("arr", v.sourceId ? String(v.sourceId) : null)}
<input type="hidden" name="lat" value="${v.nearMe && f.center ? f.center.lat.toFixed(3) : ""}" data-near="lat"><input type="hidden" name="lng" value="${v.nearMe && f.center ? f.center.lng.toFixed(3) : ""}" data-near="lng">
<label>Sted<select name="by"><option value="">Hele ${esc(r.name)}</option>${v.nearMe ? `<option value="naer" selected>Nær mig</option>` : ""}${r.towns.map(t => `<option value="${esc(t.slug)}"${v.town?.slug === t.slug ? " selected" : ""}>${esc(t.name)}</option>`).join("")}</select></label>
<label class="km">Radius<select name="km">${RADII.map(km => `<option value="${km}"${(f.km ?? 25) === km ? " selected" : ""}>${km} km</option>`).join("")}</select></label>
<button type="submit">Vis</button><button type="button" class="ghost" id="near-me" hidden>Nær mig</button></form>`;

  const where = v.nearMe ? "nær dig" : v.town ? `i ${v.town.name}` : `i ${r.name}`;
  const radius = f.center && f.km ? ` inden for ${f.km} km` : "";
  const when = WHEN.find(w => w.slug === f.when)!.label.toLocaleLowerCase("da-DK");
  const count = `<p class="count" aria-live="polite"><b>${v.events.length}</b> event${v.events.length === 1 ? "" : "s"} ${esc(where)}${esc(radius)} · ${esc(f.when === "alle" ? "alle kommende" : when)}${f.topic ? ` · ${esc(topicLabel(f.topic))}` : ""}${v.sourceName ? ` · ${esc(v.sourceName)} <a href="${esc(params({ arr: null }))}">(vis alle arrangører)</a>` : ""}</p>`;

  const days = new Map<string, ShownEvent[]>();
  for (const e of v.events) {
    const key = startOfDay(Math.max(e.starts_at_ms, v.nowMs));
    days.set(key, [...(days.get(key) ?? []), e]);
  }
  const list = v.events.length ? `<div class="days">${[...days.values()].map(list => `<section class="card day"><h2>${esc(heading(Math.max(list[0]!.starts_at_ms, v.nowMs), v.nowMs))}</h2>
${list.map(e => eventLine(r.slug, e, v.nowMs)).join("")}</section>`).join("")}</div>`
    : `<div class="card"><h2>Ingen events med de valg</h2><p class="muted">Prøv en større radius, en længere periode eller alle temaer.</p><p><a class="button ghost" href="/${esc(r.slug)}">Nulstil filtre</a></p></div>`;

  // One point per place, with that place's events - the map draws them; the list stays the truth.
  const points = new Map<string, { lat: number; lng: number; events: Array<{ t: string; w: string; u: string }> }>();
  for (const e of v.events) {
    if (e.lat === null || e.lng === null) continue;
    const key = `${e.lat.toFixed(5)},${e.lng.toFixed(5)}`;
    const point = points.get(key) ?? { lat: e.lat, lng: e.lng, events: [] };
    point.events.push({ t: e.title, w: `${heading(Math.max(e.starts_at_ms, v.nowMs), v.nowMs)}${e.all_day ? "" : ` kl. ${clock(e.starts_at_ms)}`} · ${e.source_name}`, u: eventPath(r.slug, e) });
    points.set(key, point);
  }
  const center = f.center ?? { lat: r.lat, lng: r.lng };
  const map = { center, zoom: f.center && f.km ? (f.km <= 5 ? 12 : f.km <= 10 ? 11 : f.km <= 25 ? 10 : 9) : 9, radiusKm: f.center && f.km ? f.km : null, fit: !f.center,
    tiles: env.MAP_TILES || "https://tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: env.MAP_ATTRIBUTION || "© OpenStreetMap", points: [...points.values()] };

  const title = `Foredrag, kurser og workshops ${where} · ${siteName(env)}`;
  return page(env, origin, { title, path: `/${r.slug}`, section: "kalender", regionSlug: r.slug, regionName: r.name,
    description: `Foredrag, kurser og workshops inden for mental sundhed, selvudvikling og spiritualitet ${where} - samlet ét sted, med kort.`,
    head: `<link rel="stylesheet" href="/vendor/leaflet/leaflet.css"><style>${STYLE}</style>`, scripts: ["/vendor/leaflet/leaflet.js", "/map.js"],
    body: `<main><div class="hero"><h1>Det sker ${esc(where)}</h1><p class="lead">Foredrag, kurser og workshops inden for mental sundhed, selvudvikling og spiritualitet - samlet ét sted. Tilmelding sker hos arrangøren.</p></div>
<div class="filters"><nav class="chips" aria-label="Hvornår">${whenChips}</nav><nav class="chips" aria-label="Tema">${topicChips}</nav>${place}</div>
${count}<div class="layout"><div>${list}</div><div class="map-wrap"><div id="map" aria-label="Kort over events"></div><noscript>Kortet kræver JavaScript. Listen viser alle events.</noscript></div></div>
<script type="application/json" id="map-data">${scriptJson(map)}</script></main>` });
}

export type { When };
