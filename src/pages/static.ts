import { siteName, type Env } from "../env.js";
import type { Organizer } from "../events.js";
import type { Region } from "../geo.js";
import { esc, page } from "./layout.js";

/** The organizers (alphabetical, all alike), the page about the portal, and a plain not-found page. */

export function organizersPage(env: Env, origin: string, region: Region, list: Organizer[]): string {
  const items = list.length ? `<ul style="list-style:none;margin:0;padding:0;display:grid;gap:0">${list.map(o => `<li style="display:flex;justify-content:space-between;gap:12px;align-items:center;padding:14px 0;border-top:1px solid var(--line)">
<span><b>${esc(o.name)}</b>${o.website ? `<br><a class="small" href="${esc(o.website)}" rel="noopener" target="_blank">${esc(o.website.replace(/^https?:\/\//, "").replace(/\/$/, ""))}</a>` : ""}</span>
<a class="button ghost" href="/${esc(region.slug)}?nar=alle&amp;arr=${o.id}">${o.coming} kommende</a></li>`).join("")}</ul>` : `<p class="muted">Der er ingen arrangører med endnu.</p>`;
  return page(env, origin, { title: `Arrangører i ${region.name} · ${siteName(env)}`, path: `/${region.slug}/arrangorer`, section: "arrangorer", regionSlug: region.slug, regionName: region.name,
    description: `De foreninger, centre og undervisere i ${region.name}, hvis events vises her - alle på lige fod.`,
    body: `<main><div><h1>Arrangører</h1><p class="lead">Foreninger, centre og undervisere i ${esc(region.name)}, hvis kalendere vises her. Alle vises på lige fod, i alfabetisk orden.</p></div>
<div class="card">${items}</div><p><a class="button ghost" href="/om#med">Få jeres events med →</a></p></main>` });
}

export function aboutPage(env: Env, origin: string, contact: string | null): string {
  const name = siteName(env);
  return page(env, origin, { title: `Om ${name}`, path: "/om", section: "om", description: `${name} samler events inden for spiritualitet, selvudvikling og mental sundhed fra arrangørernes egne kalendere.`,
    body: `<main><div><h1>Om ${esc(name)}</h1><p class="lead">Én samlet oversigt over, hvad der rører sig inden for spiritualitet, selvudvikling og mental sundhed - begyndende i Østjylland.</p></div>
<div class="card"><h2>Uafhængig og på lige fod</h2><p>${esc(name)} tilhører ingen bestemt forening eller udbyder. Alle arrangører vises ens: events står i tidsrækkefølge, og ingen betaler for at komme først.</p>
<p>Alt kommer fra arrangørernes egne kalendere. Ændrer eller aflyser en arrangør et event, følger det med her inden for en time. Tilmelding og betaling sker altid hos arrangøren.</p></div>
<div class="card" id="med"><h2>Få jeres events med</h2><p>Det eneste, vi har brug for, er adressen på jeres offentlige kalender - en iCal-adresse (.ics) eller et RSS-feed. De fleste kalendere har en:</p>
<ul><li>Google Kalender: Indstillinger → kalenderen → "Offentlig adresse i iCal-format"</li><li>Outlook: Kalender → Del → Udgiv → ICS-link</li><li>Hjemmesider og billetsystemer: se efter "Abonnér", "iCal" eller "RSS"</li></ul>
<p>Derefter skal I ikke gøre mere. Jeres brand, jeres tilmelding og jeres betaling forbliver jeres.</p>
${contact ? `<p><a class="button" href="mailto:${esc(contact)}?subject=${encodeURIComponent(`Vores kalender til ${name}`)}">Send os jeres kalenderadresse</a></p>` : ""}</div>
<div class="card"><h2>Privatliv</h2><p>Siden bruger ingen cookies og ingen sporing. Vælger du "Nær mig", bruger din browser din position til at sætte kortet - den gemmes ikke. Vi tæller kun, hvor mange gange et event er åbnet videre til arrangøren, pr. dag og uden at vide hvem.</p></div></main>` });
}

export function notFoundPage(env: Env, origin: string): string {
  return page(env, origin, { title: `Siden findes ikke · ${siteName(env)}`, path: "/", noindex: true, description: "Siden findes ikke.",
    body: `<main><h1>Siden findes ikke</h1><p class="lead">Måske er arrangementet taget af kalenderen.</p><p><a class="button" href="/ostjylland">Se hvad der sker i Østjylland</a></p></main>` });
}
