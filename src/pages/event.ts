import { siteName, type Env } from "../env.js";
import type { ShownEvent } from "../events.js";
import type { Region } from "../geo.js";
import { formatKrMinor } from "../price.js";
import { topicLabel } from "../topics.js";
import { clock, dayLabel, esc, page, scriptJson } from "./layout.js";
import { icon } from "./ui.js";
import { eventPath, placeText } from "./region.js";

/** One event: everything the organizer's calendar says, the place on a map, and the way on to the
 * organizer, where signup and payment happen. Marked up as a schema.org Event for search and sharing. */

const STYLE = `
.event-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,38%);gap:24px;align-items:start}
.facts{display:grid;gap:10px;margin:0}.facts div{display:grid;grid-template-columns:96px 1fr;gap:10px}.facts dt{color:var(--muted);font-size:14px}.facts dd{margin:0;font-weight:550}
.text p{margin:0 0 12px}.cta{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.map-small{position:relative;height:280px;border-radius:var(--radius);overflow:hidden;border:1px solid color-mix(in srgb,var(--line) 60%,transparent);background:var(--soft)}#map{position:absolute;inset:0}
.head-row{display:flex;align-items:center;justify-content:space-between;gap:12px}.head-row .pill{background:color-mix(in srgb,var(--t) 13%,transparent);color:var(--t)}
.save-btn{min-height:40px;padding:8px 16px}.save-btn[aria-pressed="true"]{color:var(--accent);border-color:var(--accent)}.save-btn[aria-pressed="true"] svg{fill:currentColor}
.dates{list-style:none;margin:0;padding:0;display:grid;gap:6px}.dates a{font-weight:550}
@media (max-width:900px){.event-grid{grid-template-columns:1fr}}`;

type EventRow = Omit<ShownEvent, "distance"> & { removed_at_ms: number | null };

export function eventPage(env: Env, origin: string, region: Region, e: EventRow, nowMs: number, dates: ShownEvent[] = []): string {
  const over = (e.ends_at_ms ?? e.starts_at_ms + 3 * 3_600_000) < nowMs;
  const when = e.all_day ? dayLabel(e.starts_at_ms) : `${dayLabel(e.starts_at_ms)} kl. ${clock(e.starts_at_ms)}${e.ends_at_ms ? `–${clock(e.ends_at_ms)}` : ""}`;
  const place = placeText(e);
  const price = e.price_minor === null ? null : e.price_minor === 0 ? "Gratis" : formatKrMinor(e.price_minor);
  const paragraphs = (e.description ?? "").split(/\n{2,}|\n/).map(p => p.trim()).filter(Boolean);
  const outbound = `/ud/${e.id}`;
  const status = e.removed_at_ms ? `<p class="notice warn">Arrangementet er aflyst eller taget af arrangørens kalender.</p>` : over ? `<p class="notice">Arrangementet er afholdt.</p>` : "";
  const jsonLd = {
    "@context": "https://schema.org", "@type": "Event", name: e.title, startDate: new Date(e.starts_at_ms).toISOString(), ...(e.ends_at_ms ? { endDate: new Date(e.ends_at_ms).toISOString() } : {}),
    eventStatus: e.removed_at_ms ? "https://schema.org/EventCancelled" : "https://schema.org/EventScheduled",
    eventAttendanceMode: e.online ? "https://schema.org/OnlineEventAttendanceMode" : "https://schema.org/OfflineEventAttendanceMode",
    location: e.online ? { "@type": "VirtualLocation", url: e.link ?? e.source_website ?? origin + outbound }
      : { "@type": "Place", name: e.location ?? e.venue_address ?? region.name, address: e.venue_address ?? e.location ?? region.name,
        ...(e.lat !== null && e.lng !== null ? { geo: { "@type": "GeoCoordinates", latitude: e.lat, longitude: e.lng } } : {}) },
    organizer: { "@type": "Organization", name: e.source_name, ...(e.source_website ? { url: e.source_website } : {}) },
    ...(e.description ? { description: e.description.slice(0, 500) } : {}), ...(e.image_url ? { image: [e.image_url] } : {}),
    ...(e.price_minor !== null ? { offers: { "@type": "Offer", price: (e.price_minor / 100).toFixed(2), priceCurrency: "DKK", url: e.link ?? e.source_website ?? origin + outbound } } : {}),
    url: origin + eventPath(region.slug, e)
  };
  const map = e.lat !== null && e.lng !== null ? { center: { lat: e.lat, lng: e.lng }, zoom: 14, radiusKm: null, fit: false,
    tiles: env.MAP_TILES || "https://tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: env.MAP_ATTRIBUTION || "© OpenStreetMap",
    points: [{ lat: e.lat, lng: e.lng, events: [{ t: e.title, w: place ?? "", u: "" }] }] } : null;
  const description = `${when}${place ? ` · ${place}` : ""} · ${e.source_name}. ${(e.description ?? "").replace(/\s+/g, " ").slice(0, 140)}`;
  return page(env, origin, { title: `${e.title} · ${siteName(env)}`, description, path: eventPath(region.slug, e), section: "planlaeg", regionSlug: region.slug, regionName: region.name,
    noindex: Boolean(e.removed_at_ms || over),
    head: `${e.image_url ? `<meta property="og:image" content="${esc(e.image_url)}">` : ""}<meta property="og:type" content="website">
${map ? `<link rel="stylesheet" href="/vendor/leaflet/leaflet.css">` : ""}<style>${STYLE}</style><script type="application/ld+json">${scriptJson(jsonLd)}</script>`,
    scripts: map ? ["/vendor/leaflet/leaflet.js", "/map.js"] : [],
    body: `<main><p class="small"><a href="/${esc(region.slug)}/planlaeg">← Planlæg</a></p><div class="head-row"><span class="pill" data-t="${esc(e.topic)}">${esc(topicLabel(e.topic))}</span><button type="button" class="ghost save-btn" data-save="${e.id}" aria-pressed="false" hidden>${icon("gemt", 18)}<span>Gem</span></button></div><h1>${esc(e.title)}</h1>${status}
<div class="event-grid"><div class="card"><dl class="facts"><div><dt>Hvornår</dt><dd>${esc(when)}</dd></div>${place ? `<div><dt>Hvor</dt><dd>${esc(place)}</dd></div>` : ""}
<div><dt>Arrangør</dt><dd>${e.source_website ? `<a href="${esc(e.source_website)}" rel="noopener" target="_blank">${esc(e.source_name)}</a>` : esc(e.source_name)}</dd></div>
${price ? `<div><dt>Pris</dt><dd>${esc(price)}</dd></div>` : ""}</dl>
${e.removed_at_ms || over ? "" : `<p class="cta" style="margin:20px 0 0"><a class="button" href="${esc(outbound)}" rel="nofollow noopener" target="_blank">Læs mere og tilmeld hos ${esc(e.source_name)} ↗</a></p>`}
${paragraphs.length ? `<div class="text" style="margin-top:22px">${paragraphs.map(p => `<p>${esc(p)}</p>`).join("")}</div>` : ""}
${dates.length ? `<div style="margin-top:22px"><h2>Flere datoer</h2><ul class="dates">${dates.map(d => `<li><a href="${esc(eventPath(region.slug, d))}">${esc(dayLabel(d.starts_at_ms))}${d.all_day ? "" : ` kl. ${esc(clock(d.starts_at_ms))}`}</a></li>`).join("")}</ul></div>` : ""}
<p class="small muted" style="margin:18px 0 0">Oplysningerne kommer fra ${esc(e.source_name)}s egen kalender. Tjek altid detaljerne hos arrangøren.</p></div>
${map ? `<div class="map-small"><div id="map" aria-label="Kort over stedet"></div></div><script type="application/json" id="map-data">${scriptJson(map)}</script>` : ""}</div></main>` });
}
