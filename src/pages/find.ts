import { siteName, type Env } from "../env.js";
import { firstOfSeries, type ShownEvent } from "../events.js";
import type { Region } from "../geo.js";
import { SHOWN_TOPICS } from "../topics.js";
import { esc, page } from "./layout.js";
import { eventPath, heading, placeText } from "./region.js";
import { eventRow, icon, ROW_STYLE } from "./ui.js";

/** Søg and Gemt. A search looks through every coming event's title, text, organizer and place. What a
 * visitor saves stays in their own browser: /app.js puts the saved events in the address, so this page
 * only ever shows what it is asked for, and nothing about anyone is kept here. */

const STYLE = `
.find{display:grid;grid-template-columns:minmax(0,760px);gap:18px}
.search{display:flex;gap:8px}.search input{flex:1;min-height:52px;border-radius:999px;padding:0 22px;font-size:17px}.search button{min-height:52px;padding:0 22px}
.hint{display:grid;gap:10px}.hint .chips a{gap:7px}.hint .chips a::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--t)}
.empty{display:grid;justify-items:center;gap:8px;padding:44px 24px;text-align:center}.empty .ico{color:var(--faint)}.empty h2{margin:4px 0 0}.empty p{margin:0;color:var(--muted);max-width:440px}
${ROW_STYLE}`;

function grouped(region: Region, events: ShownEvent[], nowMs: number): string {
  const days = new Map<string, Array<ShownEvent & { more: number }>>();
  for (const e of firstOfSeries(events)) {
    const key = heading(Math.max(e.starts_at_ms, nowMs), nowMs);
    days.set(key, [...(days.get(key) ?? []), e]);
  }
  return [...days.entries()].map(([day, list]) => `<h2 class="day-head">${esc(day)}</h2><ul class="rows">${list.map(e => eventRow(e, eventPath(region.slug, e), placeText(e))).join("")}</ul>`).join("");
}

export function searchPage(env: Env, origin: string, region: Region, query: string, events: ShownEvent[] | null, nowMs: number): string {
  const found = events ?? [];
  const results = events === null
    ? `<div class="hint"><p class="muted" style="margin:0">Søg efter et emne, en kunstner, et sted eller en arrangør - eller vælg en kategori:</p>
<nav class="chips" aria-label="Kategorier">${SHOWN_TOPICS.map(t => `<a data-t="${t.slug}" href="/${esc(region.slug)}/planlaeg?nar=alle&amp;tema=${t.slug}">${esc(t.label)}</a>`).join("")}</nav></div>`
    : found.length ? `<p class="muted" style="margin:0">${found.length} kommende event${found.length === 1 ? "" : "s"} for "${esc(query)}"</p><div>${grouped(region, found, nowMs)}</div>`
    : `<div class="card empty">${icon("sog", 34)}<h2>Intet fundet</h2><p>Ingen kommende events matcher "${esc(query)}". Prøv et andet ord, eller se alt i Planlæg.</p></div>`;
  return page(env, origin, { title: `${query ? `${query} · ` : ""}Søg · ${siteName(env)}`, path: `/${region.slug}/sog`, section: "sog", regionSlug: region.slug, regionName: region.name,
    description: `Søg i alt, hvad der sker i ${region.name}.`, noindex: Boolean(query), head: `<style>${STYLE}</style>`,
    body: `<main class="find"><h1>Søg</h1><form class="search" method="get" action="/${esc(region.slug)}/sog" role="search">
<input type="search" name="q" value="${esc(query)}" placeholder="Fx yoga, sorg, Silkeborg …" aria-label="Søg" enterkeyhint="search" autocomplete="off"${query ? "" : " autofocus"}><button type="submit">Søg</button></form>
${results}</main>` });
}

export function savedPage(env: Env, origin: string, region: Region, asked: boolean, events: ShownEvent[], nowMs: number): string {
  const list = events.length ? `<div>${grouped(region, events, nowMs)}</div>`
    : `<div class="card empty">${icon("gemt", 34)}<h2>${asked ? "Dine gemte events er afholdt" : "Intet gemt endnu"}</h2>
<p>Tryk på bogmærket på et event i Udforsk eller på eventets side, så samles det her. Det gemmes kun i din egen browser.</p><p><a class="button" href="/${esc(region.slug)}">Udforsk</a></p></div>`;
  return page(env, origin, { title: `Gemt · ${siteName(env)}`, path: `/${region.slug}/gemt`, section: "gemt", regionSlug: region.slug, regionName: region.name, noindex: true,
    description: "Dine gemte events.", head: `<style>${STYLE}</style>`,
    body: `<main class="find"><h1>Gemt</h1><div id="saved" data-region="${esc(region.slug)}" data-found="${events.map(e => e.id).join(",")}"${asked ? ' data-asked="1"' : ""}>${list}</div></main>` });
}
