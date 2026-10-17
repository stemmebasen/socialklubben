import { siteName, type Env } from "../env.js";
import type { Organizer } from "../events.js";
import type { Region } from "../geo.js";
import { esc, page } from "./layout.js";

/** The organizers (alphabetical, all alike), the page about the portal, and a plain not-found page. */

export function organizersPage(env: Env, origin: string, region: Region, list: Organizer[]): string {
  const items = list.length ? `<ul style="list-style:none;margin:0;padding:0;display:grid;gap:0">${list.map(o => `<li style="display:flex;justify-content:space-between;gap:12px;align-items:center;padding:14px 0;border-top:1px solid var(--line)">
<span><b>${esc(o.name)}</b>${o.website ? `<br><a class="small" href="${esc(o.website)}" rel="noopener" target="_blank">${esc(o.website.replace(/^https?:\/\//, "").replace(/\/$/, ""))}</a>` : ""}</span>
<a class="button ghost" href="/${esc(region.slug)}/planlaeg?nar=alle&amp;arr=${o.id}">${o.coming} kommende</a></li>`).join("")}</ul>` : `<p class="muted">Der er ingen arrangører med endnu.</p>`;
  return page(env, origin, { title: `Arrangører i ${region.name} · ${siteName(env)}`, path: `/${region.slug}/arrangorer`, section: "arrangorer", regionSlug: region.slug, regionName: region.name,
    description: `De udvalgte foreninger, centre og undervisere i ${region.name}, hvis events vises her - alle på lige fod.`,
    body: `<main><div><h1>Arrangører</h1><p class="lead">De udvalgte foreninger, centre og undervisere i ${esc(region.name)}, hvis events vises her. Alle vises på lige fod, i alfabetisk orden.</p></div>
<div class="card">${items}</div><p><a class="button ghost" href="/om#med">Få jeres events med →</a></p></main>` });
}

export function aboutPage(env: Env, origin: string, contact: string | null): string {
  const name = siteName(env);
  return page(env, origin, { title: `Om ${name}`, path: "/om", section: "om", description: `${name} samler kulturlivet i Østjylland ét sted: koncerter, teater, udstillinger, foredrag, fællesskaber og meget mere.`,
    body: `<main><div><h1>Om ${esc(name)}</h1><p class="lead">Kulturlivet i Østjylland samlet ét sted: koncerter, teater, film, udstillinger, foredrag, mad, sport, workshops og fællesskaber - store og små.</p></div>
<div class="card"><h2>Sammen er bedre</h2><p>${esc(name)} skal også være et sted, hvor man kan blive en del af en cirkel og tage til events sammen med andre. Den del er under udvikling.</p></div>
<div class="card"><h2>Udvalgt, uafhængig og på lige fod</h2><p>${esc(name)} tilhører ingen bestemt forening eller udbyder. Arrangørerne er udvalgt efter relevans og kvalitet, og de vises ens: events står i tidsrækkefølge, og ingen betaler for at komme først.</p>
<p>Alt kommer fra arrangørernes egne kalendere. Ændrer eller aflyser en arrangør et event, følger det med her inden for en time. Tilmelding og betaling sker altid hos arrangøren.</p></div>
<div class="card" id="med"><h2>Få jeres events med</h2><p>Arrangerer I events i Østjylland, så hører vi gerne fra jer. Bliver I en del af ${esc(name)}, er det eneste, vi har brug for, adressen på jeres offentlige kalender - en iCal-adresse (.ics) eller et RSS-feed. De fleste kalendere har en:</p>
<ul><li>Google Kalender: Indstillinger → kalenderen → "Offentlig adresse i iCal-format"</li><li>Outlook: Kalender → Del → Udgiv → ICS-link</li><li>Hjemmesider og billetsystemer: se efter "Abonnér", "iCal" eller "RSS"</li></ul>
<p>Derefter skal I ikke gøre mere. Jeres brand, jeres tilmelding og jeres betaling forbliver jeres.</p>
${contact ? `<p><a class="button" href="mailto:${esc(contact)}?subject=${encodeURIComponent(`Om at komme med i ${name}`)}">Kontakt os</a></p>` : ""}</div>
<div class="card" id="app"><h2>Som app på telefonen</h2><p>${esc(name)} kan ligge på din hjemmeskærm som en app. Den åbner direkte i Udforsk, og sider, du har set, kan åbnes uden forbindelse.</p>
<ul><li>iPhone: åbn siden i Safari, tryk på Del og vælg "Føj til hjemmeskærm".</li><li>Android: åbn siden i Chrome, tryk på menuen og vælg "Installer app".</li></ul>
<p><button type="button" id="install" hidden>Installer appen</button></p></div>
<div class="card"><h2>Privatliv</h2><p>Siden bruger ingen cookies og ingen sporing. Vælger du "Nær mig", bruger din browser din position til at sætte kortet - den gemmes ikke. Events, du gemmer, ligger kun i din egen browser. Vi tæller kun, hvor mange gange et event er åbnet videre til arrangøren, pr. dag og uden at vide hvem.</p></div></main>` });
}

export function notFoundPage(env: Env, origin: string): string {
  return page(env, origin, { title: `Siden findes ikke · ${siteName(env)}`, path: "/", noindex: true, description: "Siden findes ikke.",
    body: `<main><h1>Siden findes ikke</h1><p class="lead">Måske er arrangementet taget af kalenderen.</p><p><a class="button" href="/ostjylland">Se hvad der sker i Østjylland</a></p></main>` });
}

/** "Tip et event": anyone can tell the portal about an event. It is only shown once the administration has approved it. */
export function tipPage(env: Env, origin: string, state: { done: boolean; error: string; values: Record<string, string> }): string {
  const v = (k: string) => esc(state.values[k] ?? "");
  const body = state.done
    ? `<div class="card"><h2>Tak for tippet</h2><p>Vi kigger på det, før det kommer på siden. Det plejer at tage et par dage.</p><p><a class="button ghost" href="/tip">Tip et event mere</a></p></div>`
    : `<div class="card"><form class="tip" method="post" action="/tip">${state.error ? `<p class="notice warn" role="alert">${esc(state.error)}</p>` : ""}
<label>Titel<input name="title" required maxlength="200" value="${v("title")}"></label>
<div class="tip-row"><label>Dato<input type="date" name="date" required value="${v("date")}"></label><label>Fra kl.<input name="time" inputmode="numeric" placeholder="19.00" maxlength="5" value="${v("time")}"></label><label>Til kl.<input name="end" inputmode="numeric" placeholder="21.00" maxlength="5" value="${v("end")}"></label></div>
<label>Sted (adresse, eller "Online")<input name="place" required maxlength="200" value="${v("place")}"></label>
<div class="tip-row"><label>Arrangør<input name="organizer" maxlength="120" value="${v("organizer")}"></label><label>Link til eventet<input name="link" inputmode="url" maxlength="300" value="${v("link")}" placeholder="https://"></label></div>
<label>Kort beskrivelse<textarea name="description" maxlength="3000">${v("description")}</textarea></label>
<label>Din e-mail (valgfri, kun hvis vi har spørgsmål; vises aldrig)<input type="email" name="contact" maxlength="200" value="${v("contact")}"></label>
<label class="hp" aria-hidden="true">Lad feltet stå tomt<input name="hjemmeside" tabindex="-1" autocomplete="off"></label>
<p style="margin:0"><button>Send tippet</button></p></form></div>`;
  return page(env, origin, { title: `Tip et event · ${siteName(env)}`, path: "/tip", description: "Kender du et event, der hører til her? Tip os.",
    head: `<style>.tip{display:grid;gap:12px}.tip-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}.hp{position:absolute;left:-9999px}</style>`,
    body: `<main style="max-width:760px"><div><h1>Tip et event</h1><p class="lead">Kender du et event, der hører til her? Fortæl os om det. Vi tjekker alle tips, før de kommer på siden.</p></div>${body}</main>` });
}
