import type { Env } from "../env.js";
import { formatKrMinor } from "../price.js";
import type { Candidate, Site } from "../scan.js";
import type { Source } from "../sources.js";
import { TOPICS, topicFor } from "../topics.js";
import { clock, dayLabel, esc } from "../pages/layout.js";
import { adminPage } from "./pages.js";

/** The scanner's pages in the administration: the queue of finds to decide on, and the sites it reads. */

const SCANNED = new Intl.DateTimeFormat("da-DK", { timeZone: "Europe/Copenhagen", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const STYLE = `<style>
.finds{display:grid;gap:14px}.find h2{margin:0 0 2px}.find .facts{margin:0 0 10px;color:var(--muted);font-size:14.5px}.find .text{margin:0 0 12px;font-size:14.5px;white-space:pre-line;max-height:7.5em;overflow:hidden}
.find form{display:grid;gap:10px}.find .row3{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}.dup{background:#fbefe4;color:#a4501a;padding:8px 12px;border-radius:12px;font-size:14px;margin:0 0 10px}
.origin{display:inline-block;font-size:12px;font-weight:650;padding:2px 10px;border-radius:999px;background:var(--soft);color:var(--muted);margin-bottom:6px}
</style>`;

const when = (c: Pick<Candidate, "starts_at_ms" | "ends_at_ms" | "all_day">) =>
  `${dayLabel(c.starts_at_ms)}${c.all_day ? "" : ` kl. ${clock(c.starts_at_ms)}${c.ends_at_ms ? `–${clock(c.ends_at_ms)}` : ""}`}`;

export function findsPage(env: Env, data: { finds: Array<Candidate & { site_url: string | null; site_name: string | null }>; sources: Source[]; notice: string }): string {
  const sourceOptions = (c: Candidate) => {
    const match = data.sources.find(s => c.organizer && s.name.toLocaleLowerCase("da-DK") === c.organizer.toLocaleLowerCase("da-DK"));
    return `<option value="ny"${match ? "" : " selected"}>Ny arrangør (navnet herunder)</option>${data.sources.map(s => `<option value="${s.id}"${match?.id === s.id ? " selected" : ""}>${esc(s.name)}${s.kind === "manual" ? "" : " (har kalender)"}</option>`).join("")}`;
  };
  const items = data.finds.map(c => {
    const topic = topicFor(c.title, c.description, "udvikling");
    const origin = c.origin === "tip" ? `Tip${c.contact ? ` fra ${esc(c.contact)}` : ""}` : `Scanner: ${esc(c.site_name || c.site_url || "")}`;
    const facts = [when(c), c.location, c.organizer, c.price_minor === null ? null : c.price_minor === 0 ? "Gratis" : formatKrMinor(c.price_minor)].filter(Boolean).map(esc).join(" · ");
    return `<article class="card find"><span class="origin">${origin}</span><h2>${esc(c.title)}</h2><p class="facts">${facts}${c.link ? ` · <a href="${esc(c.link)}" rel="noopener noreferrer" target="_blank">Se siden ↗</a>` : ""}</p>
${c.duplicate_of ? `<p class="dup">Ligner et event, der allerede vises (samme tid, næsten samme titel). Afvis det, hvis det er det samme.</p>` : ""}
${c.description ? `<p class="text">${esc(c.description)}</p>` : ""}
<form method="post" action="/admin/fund/${c.id}"><div class="row3"><label>Arrangør<select name="source">${sourceOptions(c)}</select></label>
<label>Ny arrangørs navn<input name="new_name" maxlength="120" value="${esc(c.organizer ?? "")}"></label>
<label>Tema<select name="topic">${TOPICS.map(t => `<option value="${t.slug}"${t.slug === topic ? " selected" : ""}>${esc(t.label)}</option>`).join("")}</select></label></div>
<label>Adresse til kortet (tom = arrangørens eller den, der står)<input name="address" maxlength="200" value="${esc(c.location && /\d/.test(c.location) ? c.location : "")}"></label>
<div class="acts"><button name="action" value="approve">Vis på portalen</button><button class="ghost" name="action" value="reject">Afvis</button></div></form></article>`;
  }).join("");
  return adminPage(env, "Fund", `<main><h1>Fund</h1><p class="lead">Events, scanneren har fundet, og tips fra besøgende. Intet vises, før det er godkendt her. Felter, siden ikke oplyser, står tomme.</p>
${data.notice ? `<p class="notice">${esc(data.notice)}</p>` : ""}${STYLE}
${items ? `<div class="finds">${items}</div>` : `<div class="card"><p class="muted" style="margin:0">Ingen nye fund. Scanneren læser siderne under Scanner en gang om ugen, og tips kommer fra siden "Tip et event".</p></div>`}</main>`, "fund");
}

export function sitesPage(env: Env, data: { sites: Site[]; notice: string; error: string }): string {
  const status = (s: Site) => s.source_id ? `<span class="muted">Kalenderen er en arrangør; siden læses ikke længere</span>` : s.last_scan_at_ms === null ? `<span class="muted">Ikke læst endnu</span>`
    : `<span class="${s.last_scan_ok ? "muted" : "bad"}">${esc(SCANNED.format(s.last_scan_at_ms))}: ${esc(s.last_scan_message ?? "")}</span>`;
  const feed = (s: Site) => s.feed_url && !s.source_id
    ? `<br><span class="meta">Kalender fundet: ${esc(s.feed_url)} · <a href="/admin?ny=1&amp;name=${encodeURIComponent(s.name ?? "")}&amp;website=${encodeURIComponent(new URL(s.url).origin)}&amp;feed_url=${encodeURIComponent(s.feed_url)}#ny">Tilføj som arrangør →</a></span>` : "";
  const list = data.sites.map(s => `<li${s.status === "paused" ? ' class="off"' : ""}><span><b>${esc(s.name || new URL(s.url).hostname)}</b> <a class="meta" href="${esc(s.url)}" rel="noopener noreferrer" target="_blank">${esc(s.url)}</a></span>
<span class="meta">${status(s)}${feed(s)}</span><form method="post" action="/admin/scanner/${s.id}">${s.source_id ? "" : `<button class="ghost" name="action" value="scan">Læs nu</button>`}
<button class="ghost" name="action" value="${s.status === "active" ? "pause" : "activate"}">${s.status === "active" ? "Pause" : "Aktivér"}</button><button class="ghost" name="action" value="delete">Fjern</button></form></li>`).join("");
  return adminPage(env, "Scanner", `<main><h1>Scanner</h1><p class="lead">Sider, scanneren læser en gang om ugen. Den tager de events, siden selv beskriver for søgemaskiner (schema.org), og finder kalenderadresser. Sider, der beder robotter holde sig væk (robots.txt), læses ikke.</p>
${data.notice ? `<p class="notice">${esc(data.notice)}</p>` : ""}${data.error ? `<p class="notice warn" role="alert">${esc(data.error)}</p>` : ""}
<div class="card"><h2>Tilføj en side</h2><form class="form" method="post" action="/admin/scanner"><div class="two"><label>Sidens adresse (helst eventoversigten)<input name="url" required maxlength="500" placeholder="https://studie.dk/events"></label>
<label>Navn (valgfrit)<input name="name" maxlength="120" placeholder="Studiets navn"></label></div><p style="margin:0"><button>Tilføj og læs</button></p></form></div>
<div class="card"><h2>${data.sites.length} side${data.sites.length === 1 ? "" : "r"}</h2>${list ? `<ul class="list">${list}</ul>` : `<p class="muted" style="margin:0">Ingen sider endnu.</p>`}</div></main>`, "scanner");
}
