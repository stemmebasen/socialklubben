import { siteName, type Env } from "../env.js";
import { firstOfSeries, WHEN, type Filter, type ShownEvent, type When } from "../events.js";
import { RADII, type Region, type Town } from "../geo.js";
import { SHOWN_TOPICS, topicLabel } from "../topics.js";
import { dayLabel, esc, page, slug } from "./layout.js";
import { eventRow, ROW_STYLE } from "./ui.js";

/** Planlæg: a region's events as a list by day, with filters for when, theme and distance. A series is
 * shown once with how many more dates it has. Everything is in the address (shareable, no JavaScript
 * needed); the map lives in Udforsk. */

const STYLE = `
.hero{display:grid;gap:4px}
.filters{display:grid;gap:12px}.place{display:flex;gap:8px;flex-wrap:wrap;align-items:end}.place label{flex:1 1 180px}.place .km{flex:0 1 130px}.place button{flex:none}
.plan{display:grid;grid-template-columns:minmax(0,760px);gap:0}
.count{margin:0;color:var(--muted);font-size:15px}
@media (max-width:720px){.place{display:grid;grid-template-columns:minmax(0,1fr) 96px auto;gap:8px}.place label{font-size:12.5px}.place button[data-auto][hidden]+button{align-self:end}
.filters .chips{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;margin:0 -16px;padding:4px 16px 8px}.filters .chips::-webkit-scrollbar{display:none}}
${ROW_STYLE}`;

export type RegionView = { region: Region; filter: Filter; town: Town | null; nearMe: boolean; events: ShownEvent[]; nowMs: number; sourceName: string | null; sourceId: number | null };

const startOfDay = (ms: number) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Copenhagen" }).format(ms);

export function eventPath(region: string, event: { id: number; title: string }): string {
  return `/${region}/e/${event.id}-${slug(event.title)}`;
}

export function heading(ms: number, nowMs: number): string {
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

export function planPage(env: Env, origin: string, v: RegionView): string {
  const r = v.region, f = v.filter;
  const params = (change: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const base: Record<string, string | null> = { nar: f.when === "maaned" ? null : f.when, tema: f.topic, by: v.town?.slug ?? (v.nearMe ? "naer" : null), km: f.km && f.center ? String(f.km) : null,
      lat: v.nearMe && f.center ? f.center.lat.toFixed(3) : null, lng: v.nearMe && f.center ? f.center.lng.toFixed(3) : null, arr: v.sourceId ? String(v.sourceId) : null };
    for (const [k, val] of Object.entries({ ...base, ...change })) if (val) p.set(k, val);
    const q = p.toString();
    return `/${r.slug}/planlaeg${q ? `?${q}` : ""}`;
  };
  const chip = (href: string, label: string, on: boolean) => `<a href="${esc(href)}"${on ? ' class="on" aria-current="true"' : ""}>${esc(label)}</a>`;
  const whenChips = WHEN.map(w => chip(params({ nar: w.slug === "maaned" ? null : w.slug }), w.label, f.when === w.slug)).join("");
  const topicChips = chip(params({ tema: null }), "Alle kategorier", !f.topic) + SHOWN_TOPICS.map(t => chip(params({ tema: t.slug }), t.label, f.topic === t.slug)).join("");
  const keep = (name: string, value: string | null) => value ? `<input type="hidden" name="${name}" value="${esc(value)}">` : "";
  const place = `<form class="place" method="get" action="/${esc(r.slug)}/planlaeg">${keep("nar", f.when === "maaned" ? null : f.when)}${keep("tema", f.topic)}${keep("arr", v.sourceId ? String(v.sourceId) : null)}
<input type="hidden" name="lat" value="${v.nearMe && f.center ? f.center.lat.toFixed(3) : ""}" data-near="lat"><input type="hidden" name="lng" value="${v.nearMe && f.center ? f.center.lng.toFixed(3) : ""}" data-near="lng">
<label>Sted<select name="by"><option value="">Alle steder</option>${v.nearMe ? `<option value="naer" selected>Nær mig</option>` : ""}${r.towns.map(t => `<option value="${esc(t.slug)}"${v.town?.slug === t.slug ? " selected" : ""}>${esc(t.name)}</option>`).join("")}</select></label>
<label class="km">Radius<select name="km">${RADII.map(km => `<option value="${km}"${(f.km ?? 25) === km ? " selected" : ""}>${km} km</option>`).join("")}</select></label>
<button type="submit" data-auto>Vis</button><button type="button" class="ghost" id="near-me" hidden>Nær mig</button></form>`;

  const where = v.nearMe ? "nær dig" : v.town ? `i ${v.town.name}` : `i ${r.name}`;
  const radius = f.center && f.km ? ` inden for ${f.km} km` : "";
  const when = WHEN.find(w => w.slug === f.when)!.label.toLocaleLowerCase("da-DK");
  const count = `<p class="count" aria-live="polite"><b>${v.events.length}</b> event${v.events.length === 1 ? "" : "s"} ${esc(where)}${esc(radius)} · ${esc(f.when === "alle" ? "alle kommende" : when)}${f.topic ? ` · ${esc(topicLabel(f.topic))}` : ""}${v.sourceName ? ` · ${esc(v.sourceName)} <a href="${esc(params({ arr: null }))}">(vis alle arrangører)</a>` : ""}</p>`;

  // A series is shown once, on its first date, with how many more dates it has.
  const days = new Map<string, Array<ShownEvent & { more: number }>>();
  for (const e of firstOfSeries(v.events)) {
    const key = startOfDay(Math.max(e.starts_at_ms, v.nowMs));
    days.set(key, [...(days.get(key) ?? []), e]);
  }
  const list = v.events.length ? `<div class="plan">${[...days.values()].map(list => `<h2 class="day-head">${esc(heading(Math.max(list[0]!.starts_at_ms, v.nowMs), v.nowMs))}</h2>
<ul class="rows">${list.map(e => eventRow(e, eventPath(r.slug, e), placeText(e))).join("")}</ul>`).join("")}</div>`
    : `<div class="card"><h2>Ingen events med de valg</h2><p class="muted">Prøv en større radius, en længere periode eller alle kategorier.</p><p><a class="button ghost" href="/${esc(r.slug)}/planlaeg">Nulstil filtre</a></p></div>`;

  const title = `Det sker ${where} · ${siteName(env)}`;
  return page(env, origin, { title, path: `/${r.slug}/planlaeg`, section: "planlaeg", regionSlug: r.slug, regionName: r.name,
    description: `Koncerter, teater, udstillinger, foredrag, fællesspisning og meget mere ${where} - dag for dag.`,
    head: `<style>${STYLE}</style>`,
    body: `<main><div class="hero"><h1>Planlæg</h1><p class="lead" style="margin:0">Det sker ${esc(where)}</p></div>
<div class="filters"><nav class="chips" aria-label="Hvornår">${whenChips}</nav><nav class="chips" aria-label="Kategori">${topicChips}</nav>${place}</div>
${count}${list}</main>` });
}

export type { When };
