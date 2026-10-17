import { siteName, type Env } from "../env.js";
import { WINDOW_DAYS, type Source } from "../sources.js";
import { TOPICS, topicLabel } from "../topics.js";
import { clock, dayLabel, esc, STYLE } from "../pages/layout.js";

/** The administration's pages: the organizers' calendars, their events and the places on the map. */

const SYNCED = new Intl.DateTimeFormat("da-DK", { timeZone: "Europe/Copenhagen", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const ADMIN_STYLE = `
.top{justify-content:space-between}.adm-nav{display:flex;gap:4px;align-items:center}.adm-nav a{padding:8px 14px;border-radius:999px;text-decoration:none;color:var(--ink);font-weight:500}
.adm-nav a.on{background:var(--card);box-shadow:var(--shadow);font-weight:600}.adm-nav form{margin:0}
.list{list-style:none;margin:0;padding:0}.list li{display:grid;grid-template-columns:1fr auto;gap:3px 14px;align-items:center;padding:12px 0;border-top:1px solid var(--line)}.list li:first-child{border-top:0}
.list .meta{font-size:13.5px;color:var(--muted)}.list form{margin:0;grid-row:1/span 3;grid-column:2;display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.off{opacity:.55}
.form{display:grid;gap:10px}.two{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}.acts{display:flex;gap:8px;flex-wrap:wrap}.acts form{margin:0}
.bad{color:#a4501a}.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.stats div{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 14px}
.stats b{display:block;font-size:24px}.stats span{font-size:13px;color:var(--muted)}`;

export function adminPage(env: Env, title: string, body: string, section: "kilder" | "fund" | "scanner" | "steder" | null): string {
  const nav = (key: string, href: string, label: string) => `<a href="${href}"${section === key ? ' class="on"' : ""}>${label}</a>`;
  return `<!doctype html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>${esc(title)} · ${esc(siteName(env))} administration</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300..700&display=swap">
<style>${STYLE}${ADMIN_STYLE}</style></head><body><header class="bar"><div class="top"><a class="brand" href="/admin"><div><b>${esc(siteName(env))}</b><span>Administration</span></div></a>
${section ? `<nav class="adm-nav">${nav("kilder", "/admin", "Kilder")}${nav("fund", "/admin/fund", "Fund")}${nav("scanner", "/admin/scanner", "Scanner")}${nav("steder", "/admin/steder", "Steder")}<a href="/ostjylland">Se siden ↗</a><form method="post" action="/admin/logout"><button class="ghost">Log ud</button></form></nav>` : ""}</div></header>
${body}</body></html>`;
}

export function loginPage(env: Env, message: string, configured: boolean): string {
  return adminPage(env, "Log ind", `<main style="max-width:440px"><h1>Log ind</h1>${configured
    ? `${message ? `<p class="notice warn" role="alert">${esc(message)}</p>` : ""}<form class="form" method="post" action="/admin/login"><label>Adgangskode<input type="password" name="password" required autocomplete="current-password" autofocus></label><button>Log ind</button></form>`
    : `<p class="notice">Administrationen er ikke sat op endnu: adgangskoden (ADMIN_PASSWORD) mangler.</p>`}</main>`, null);
}

const syncLine = (s: Pick<Source, "last_sync_at_ms" | "last_sync_ok" | "last_sync_message">) => s.last_sync_at_ms === null ? `<span class="muted">Ikke hentet endnu</span>`
  : `<span class="${s.last_sync_ok ? "muted" : "bad"}">${s.last_sync_ok ? "Hentet" : "Fejl"} ${esc(SYNCED.format(s.last_sync_at_ms))}: ${esc(s.last_sync_message ?? "")}</span>`;

export type FormValues = Partial<Record<"name" | "website" | "feed_url" | "default_address" | "default_topic" | "include_words" | "exclude_words" | "contact_email" | "note", string>>;
export const FORM_FIELDS = ["name", "website", "feed_url", "default_address", "default_topic", "include_words", "exclude_words", "contact_email", "note"] as const;
export const formValuesFrom = (form: FormData | null): FormValues => Object.fromEntries(FORM_FIELDS.map(k => [k, String(form?.get(k) ?? "")]));
export const sourceValues = (s: Source): FormValues => ({ name: s.name, website: s.website ?? "", feed_url: s.feed_url, default_address: s.default_address ?? "", default_topic: s.default_topic,
  include_words: s.include_words ?? "", exclude_words: s.exclude_words ?? "", contact_email: s.contact_email ?? "", note: s.note ?? "" });

function sourceForm(action: string, v: FormValues, button: string): string {
  return `<form class="form" method="post" action="${action}"><input type="hidden" name="action" value="save">
<div class="two"><label>Arrangørens navn<input name="name" required maxlength="120" value="${esc(v.name)}"></label><label>Hjemmeside<input name="website" maxlength="300" value="${esc(v.website)}" placeholder="arrangoer.dk"></label></div>
<label>Kalenderadresse (iCal/.ics eller RSS; tom for en arrangør uden kalender)<input name="feed_url" maxlength="500" value="${esc(v.feed_url)}" placeholder="https://… eller webcal://…"></label>
<div class="two"><label>Adresse, når et event ikke har sin egen<input name="default_address" maxlength="200" value="${esc(v.default_address)}" placeholder="Gade 1, 8000 Aarhus C"></label>
<label>Arrangørens typiske kategori<select name="default_topic" required>${TOPICS.map(t => `<option value="${t.slug}"${v.default_topic === t.slug ? " selected" : ""}>${esc(t.label)}</option>`).join("")}</select></label></div>
<div class="two"><label>Kun events med et af ordene (valgfrit)<input name="include_words" maxlength="300" value="${esc(v.include_words)}" placeholder="fx yoga, meditation"></label>
<label>Aldrig events med ordene (valgfrit)<input name="exclude_words" maxlength="300" value="${esc(v.exclude_words)}" placeholder="fx generalforsamling, lukket"></label></div>
<div class="two"><label>Kontakt (e-mail, vises ikke)<input type="email" name="contact_email" maxlength="200" value="${esc(v.contact_email)}"></label><label>Note (vises ikke)<input name="note" maxlength="1000" value="${esc(v.note)}"></label></div>
<p style="margin:0"><button>${esc(button)}</button></p></form>`;
}

export type ListedSource = Source & { coming: number; clicks: number };

export function sourcesPage(env: Env, data: { sources: ListedSource[]; pendingVenues: number; notice: string; error: string; values: FormValues }): string {
  const active = data.sources.filter(s => s.status === "active");
  return adminPage(env, "Kilder", `<main><h1>Kilder</h1><p class="lead">Arrangørernes offentlige kalendere. Hver aktiv kalender hentes hver time; ændringer og aflysninger følger med af sig selv.</p>
${data.notice ? `<p class="notice">${esc(data.notice)}</p>` : ""}
<div class="stats"><div><b>${active.length}</b><span>aktive arrangører</span></div><div><b>${active.reduce((n, s) => n + s.coming, 0)}</b><span>kommende events</span></div>
<div><b>${data.sources.reduce((n, s) => n + s.clicks, 0)}</b><span>klik videre, 30 dage</span></div><div><b>${data.pendingVenues}</b><span><a href="/admin/steder">steder uden placering</a></span></div></div>
<div class="card"><h2>Arrangører</h2>${data.sources.length ? `<ul class="list">${data.sources.map(s => `<li class="${s.status === "active" ? "" : "off"}"><span><a href="/admin/kilder/${s.id}"><b>${esc(s.name)}</b></a>${s.status === "paused" ? ` <span class="pill dim">På pause</span>` : ""}</span>
<span class="meta">${s.coming} kommende · ${esc(topicLabel(s.default_topic))} · ${s.clicks} klik videre (30 dage)</span><span class="meta">${syncLine(s)}</span></li>`).join("")}</ul>`
    : `<p class="muted">Ingen kilder endnu. Tilføj den første arrangør nedenfor.</p>`}</div>
<div class="card" id="ny"><h2>Ny arrangør</h2>${data.error ? `<p class="notice warn" role="alert">${esc(data.error)}</p>` : ""}${sourceForm("/admin/kilder", data.values, "Tilføj og hent events")}</div></main>`, "kilder");
}

export type AdminEvent = { id: number; title: string; starts_at_ms: number; all_day: number; online: number; topic: string; hidden: number; removed_at_ms: number | null; venue_status: string | null; clicks: number };

export function sourcePage(env: Env, data: { source: Source; events: AdminEvent[]; notice: string; error: string; values: FormValues | null }): string {
  const s = data.source, here = `/admin/kilder/${s.id}`;
  const line = (e: AdminEvent) => `<li class="${e.hidden || e.removed_at_ms ? "off" : ""}"><span><a href="/${esc(s.region)}/e/${e.id}">${esc(e.title)}</a>${e.hidden ? ` <span class="pill dim">Skjult</span>` : ""}${e.removed_at_ms ? ` <span class="pill dim">Aflyst/fjernet</span>` : ""}</span>
<span class="meta">${esc(dayLabel(e.starts_at_ms))}${e.all_day ? "" : ` kl. ${esc(clock(e.starts_at_ms))}`} · ${esc(topicLabel(e.topic))}${e.online ? " · online" : e.venue_status === "found" || e.venue_status === "manual" ? "" : " · <span class=\"bad\">ikke på kortet</span>"}${e.clicks ? ` · ${e.clicks} klik` : ""}</span>
${e.removed_at_ms ? "" : `<form method="post" action="${here}"><input type="hidden" name="event" value="${e.id}"><button class="ghost" name="action" value="${e.hidden ? "show" : "hide"}">${e.hidden ? "Vis igen" : "Skjul"}</button></form>`}</li>`;
  return adminPage(env, s.name, `<main><p class="small"><a href="/admin">← Kilder</a></p><h1>${esc(s.name)}</h1>${data.notice ? `<p class="notice">${esc(data.notice)}</p>` : ""}
<p class="small">${syncLine(s)}</p><div class="acts"><form method="post" action="${here}"><button name="action" value="sync">Hent nu</button></form>
<form method="post" action="${here}"><button class="ghost" name="action" value="${s.status === "active" ? "pause" : "activate"}">${s.status === "active" ? "Sæt på pause" : "Gør aktiv igen"}</button></form></div>
<div class="card"><h2>Kommende events</h2>${data.events.length ? `<ul class="list">${data.events.map(line).join("")}</ul>` : `<p class="muted">Ingen kommende events.</p>`}
<p class="small muted">Gentagne serier (fx ugentlige hold) og private events vises ikke. Events vises ${WINDOW_DAYS} dage frem.</p></div>
<div class="card"><h2>Kilden</h2>${data.error ? `<p class="notice warn" role="alert">${esc(data.error)}</p>` : ""}${sourceForm(here, data.values ?? sourceValues(s), "Gem")}</div></main>`, "kilder");
}

export type AdminVenue = { id: number; address: string; lat: number | null; lng: number | null; status: string; attempts: number; events: number };

export function venuesPage(env: Env, data: { venues: AdminVenue[]; notice: string }): string {
  const STATUS: Record<string, string> = { pending: "Venter på opslag", found: "Fundet", not_found: "Ikke fundet", manual: "Sat i hånden" };
  return adminPage(env, "Steder", `<main><h1>Steder</h1><p class="lead">Hvert sted slås op én gang ud fra adressen (OpenStreetMap). Kan et sted ikke findes, så sæt koordinaterne i hånden - fx ved at højreklikke på stedet i Google Maps og kopiere tallene.</p>
${data.notice ? `<p class="notice">${esc(data.notice)}</p>` : ""}<div class="card">${data.venues.length ? `<ul class="list">${data.venues.map(v => `<li><span><b>${esc(v.address)}</b> <span class="pill${v.status === "found" || v.status === "manual" ? "" : " dim"}">${esc(STATUS[v.status] ?? v.status)}</span></span>
<span class="meta">${v.events} kommende event${v.events === 1 ? "" : "s"}${v.lat !== null ? ` · ${v.lat.toFixed(5)}, ${v.lng!.toFixed(5)}` : ""}</span>
<form method="post" action="/admin/steder/${v.id}"><input name="coords" placeholder="56.1567, 10.2108" aria-label="Koordinater" style="max-width:190px;min-height:38px;padding:6px 10px"><button class="ghost" name="action" value="set">Sæt</button><button class="ghost" name="action" value="retry">Slå op igen</button></form></li>`).join("")}</ul>`
    : `<p class="muted">Ingen steder endnu.</p>`}</div></main>`, "steder");
}
