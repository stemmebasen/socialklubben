import { siteName, type Env } from "../env.js";
import { icon, THEME_STYLE } from "./ui.js";

/** Every page's frame. The cockpit's clean system - cool paper, white cards, deep ink, one cobalt accent,
 * Bricolage Grotesque, pill buttons, a glass header - without its soft glow: requested, "siden må ikke have
 * en spirituel vibe, den skal være professionel, moderne og elegant". No aura colours, no ornaments, a plain
 * wordmark; and no organizer's name or logo: the portal belongs to no one. */

export const esc = (value: unknown) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** JSON for a <script type="application/json|ld+json"> block: nothing in it can close the tag. */
export const scriptJson = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");

export const STYLE = `
:root{--bg:#eef1f4;--card:#fff;--ink:#16202e;--muted:#5a6675;--faint:#7d8896;--line:#dce2e9;--accent:#2446d8;--accent-ink:#fff;--soft:#f1f4f8;--tint:#e8edfd;
--shadow:0 1px 2px rgba(22,32,46,.04),0 10px 30px -18px rgba(22,32,46,.18);--radius:20px;
--font:"Bricolage Grotesque",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color-scheme:light dark}
@media (prefers-color-scheme:dark){:root{--bg:#121821;--card:#1a222d;--ink:#e8edf3;--muted:#9aa6b4;--faint:#748191;--line:#2a3441;--accent:#7c93ff;--accent-ink:#0e1522;--soft:#212a36;--tint:#1f2a4a;
--shadow:none}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 var(--font);font-optical-sizing:auto;-webkit-font-smoothing:antialiased;overflow-x:clip}
a{color:var(--accent);text-decoration-thickness:1px;text-underline-offset:.2em}:focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:6px}
header.bar{position:sticky;top:0;z-index:1000}
header.bar::before{content:"";position:absolute;inset:0;z-index:-1;background:color-mix(in srgb,var(--bg) 86%,transparent);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid color-mix(in srgb,var(--line) 70%,transparent)}
.top{max-width:1240px;margin:0 auto;padding:12px 24px;display:flex;align-items:center;gap:20px}
.brand{display:flex;align-items:baseline;gap:12px;text-decoration:none;color:var(--ink);white-space:nowrap}
.brand b{font-weight:700;font-size:19px;letter-spacing:-.02em}.brand span{font-size:11.5px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.14em}
nav.main{display:flex;gap:4px;margin-left:auto}nav.main a{padding:8px 14px;border-radius:999px;text-decoration:none;color:var(--ink);font-weight:500;font-size:15px;white-space:nowrap}
nav.main a:hover{color:var(--accent)}nav.main a.on{background:var(--card);box-shadow:var(--shadow);font-weight:600}
main{max-width:1240px;margin:0 auto;padding:32px 24px 72px;display:grid;gap:20px}
h1{font-size:clamp(32px,4.4vw,52px);line-height:1.02;margin:0;letter-spacing:-.03em;font-weight:700}h2{font-size:20px;margin:0 0 12px;font-weight:650;letter-spacing:-.015em;line-height:1.2}
.lead{margin:6px 0 0;color:var(--muted);font-size:17px;max-width:720px}
.card{background:var(--card);border-radius:var(--radius);padding:24px 26px;min-width:0;box-shadow:var(--shadow);border:1px solid color-mix(in srgb,var(--line) 60%,transparent)}
.muted{color:var(--muted)}.small{font-size:14px}
.chips{display:flex;gap:8px;flex-wrap:wrap}.chips a{display:inline-flex;align-items:center;padding:7px 14px;border-radius:999px;background:var(--card);box-shadow:var(--shadow);font-size:14px;font-weight:550;color:var(--ink);text-decoration:none;white-space:nowrap}
.chips a:hover{color:var(--accent)}.chips a.on{background:var(--accent);color:var(--accent-ink)}
.pill{display:inline-block;font-size:12px;font-weight:650;padding:2px 10px;border-radius:999px;background:var(--tint);color:var(--accent);white-space:nowrap}.pill.dim{background:var(--soft);color:var(--muted)}
label{display:grid;gap:6px;font-size:13.5px;font-weight:600;color:var(--muted)}
input,textarea,select{font:inherit;font-size:16px;font-weight:400;color:var(--ink);background:var(--soft);border:1px solid var(--line);border-radius:12px;padding:10px 14px;width:100%;min-height:44px}
input:focus,textarea:focus,select:focus{outline:3px solid color-mix(in srgb,var(--accent) 22%,transparent);border-color:var(--accent);background:var(--card)}textarea{min-height:110px;resize:vertical}
button,.button{font:inherit;font-weight:650;font-size:15px;border:0;border-radius:999px;padding:11px 20px;min-height:44px;background:var(--accent);color:var(--accent-ink);cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:6px}
button:hover,.button:hover{filter:brightness(1.08)}button.ghost,.button.ghost{background:transparent;color:var(--ink);border:1.5px solid var(--line)}button.ghost:hover,.button.ghost:hover{border-color:var(--accent);color:var(--accent);filter:none}
.notice{padding:14px 18px;border-radius:16px;background:var(--tint);color:var(--ink)}.notice.warn{background:#fbefe4;color:#a4501a}
footer.site{max-width:1240px;margin:0 auto;padding:28px 24px 48px;color:var(--muted);font-size:14px;display:flex;gap:10px 24px;flex-wrap:wrap;justify-content:space-between;border-top:1px solid var(--line)}
footer.site a{color:var(--muted)}
[hidden]{display:none!important}
.tabs{display:none}
@media (max-width:720px){
.tabs{display:grid;grid-template-columns:repeat(4,1fr);position:fixed;left:0;right:0;bottom:0;z-index:1200;padding:6px 6px calc(6px + env(safe-area-inset-bottom));
background:color-mix(in srgb,var(--card) 88%,transparent);backdrop-filter:blur(16px) saturate(1.4);-webkit-backdrop-filter:blur(16px) saturate(1.4);border-top:1px solid color-mix(in srgb,var(--line) 70%,transparent)}
.tabs a{display:grid;justify-items:center;gap:2px;padding:6px 0 2px;font-size:11.5px;font-weight:600;color:var(--faint);text-decoration:none}.tabs a.on{color:var(--accent)}
body{padding-bottom:calc(68px + env(safe-area-inset-bottom))}nav.main a.tab{display:none}}
@media (max-width:720px){.top{padding:10px 16px;gap:10px}nav.main a.cal{display:none}.brand b{max-width:46vw;overflow:hidden;text-overflow:ellipsis;display:block}.brand span{display:none}nav.main a{padding:7px 10px;font-size:14px}main{padding:22px 16px 56px}footer.site{padding:24px 16px 40px}.card{padding:20px 18px}}`;

export type Section = "udforsk" | "planlaeg" | "gemt" | "sog" | "arrangorer" | "om";
export type PageOptions = {
  title: string; description: string; path: string; body: string; section?: Section | null; bodyClass?: string; noFooter?: boolean; regionSlug?: string; regionName?: string;
  head?: string; noindex?: boolean; scripts?: string[];
};

export function page(env: Env, origin: string, o: PageOptions): string {
  const name = siteName(env);
  const region = o.regionSlug ?? "ostjylland";
  const nav = (key: PageOptions["section"], href: string, label: string, cls = "") => `<a href="${href}" class="${[cls, o.section === key ? "on" : ""].filter(Boolean).join(" ")}"${o.section === key ? ' aria-current="page"' : ""}>${label}</a>`;
  return `<!doctype html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(o.title)}</title><meta name="description" content="${esc(o.description)}">${o.noindex ? `<meta name="robots" content="noindex,nofollow">` : ""}
<link rel="canonical" href="${esc(origin + o.path)}"><meta property="og:site_name" content="${esc(name)}"><meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(o.description)}"><meta property="og:url" content="${esc(origin + o.path)}"><meta property="og:locale" content="da_DK">
<meta name="theme-color" content="#eef1f4" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#121821" media="(prefers-color-scheme: dark)">
<link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/icons/apple-touch-icon.png"><meta name="apple-mobile-web-app-title" content="${esc(name)}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300..700&display=swap">${o.head ?? ""}
<style>${STYLE}${THEME_STYLE}</style></head><body${o.bodyClass ? ` class="${esc(o.bodyClass)}"` : ""}>
<header class="bar"><div class="top"><a class="brand" href="/${esc(region)}"><b>${esc(name)}</b><span>${esc(o.regionName ?? "Østjylland")}</span></a>
<nav class="main" aria-label="Menu">${TABS.map(([key, path, label]) => nav(key, `/${esc(region)}${path}`, label, "tab")).join("")}${nav("arrangorer", `/${esc(region)}/arrangorer`, "Arrangører")}${nav("om", "/om", "Om")}</nav></div></header>
${o.body}
${o.noFooter ? "" : `<footer class="site"><span>${esc(name)} er en uafhængig oversigt. Alt kommer fra arrangørernes egne kalendere, og tilmelding sker altid hos arrangøren.</span>
<a href="/om#med">Få jeres events med →</a></footer>`}
<nav class="tabs" aria-label="Visninger">${TABS.map(([key, path, label]) => `<a href="/${esc(region)}${path}"${o.section === key ? ' class="on" aria-current="page"' : ""}>${icon(key, 24)}<span>${label}</span></a>`).join("")}</nav>
<script src="/app.js" defer></script>${(o.scripts ?? []).map(src => `<script src="${esc(src)}" defer></script>`).join("")}</body></html>`;
}

/** The four views, as tabs at the bottom on a phone and in the menu on a larger screen. */
const TABS: Array<[Section, string, string]> = [["udforsk", "", "Udforsk"], ["planlaeg", "/planlaeg", "Planlæg"], ["gemt", "/gemt", "Gemt"], ["sog", "/sog", "Søg"]];

export const HTML_HEADERS: Record<string, string> = {
  "content-type": "text/html; charset=utf-8",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "content-security-policy": "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  "permissions-policy": "geolocation=(self), camera=(), microphone=()"
};

export const html = (body: string, status = 200, extra: Record<string, string> = {}) =>
  new Response(body, { status, headers: { ...HTML_HEADERS, "cache-control": "public, max-age=60, s-maxage=300", ...extra } });

const WEEKDAY = new Intl.DateTimeFormat("da-DK", { timeZone: "Europe/Copenhagen", weekday: "long", day: "numeric", month: "long" });
const CLOCK = new Intl.DateTimeFormat("da-DK", { timeZone: "Europe/Copenhagen", hour: "2-digit", minute: "2-digit" });
export const dayLabel = (ms: number) => WEEKDAY.format(ms);
export const clock = (ms: number) => CLOCK.format(ms).replace(":", ".");

export function slug(text: string): string {
  return text.toLocaleLowerCase("da-DK").replace(/æ/g, "ae").replace(/ø/g, "oe").replace(/å/g, "aa").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "event";
}
