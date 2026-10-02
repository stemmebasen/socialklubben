import { siteName, type Env } from "../env.js";

/** Every page's frame, in the same design language as Hjerterum's board cockpit (cool paper, white cards,
 * deep ink, one cobalt accent, Bricolage Grotesque, pill buttons, a glass header, a soft glow) - but with
 * no organizer's name or logo: the portal belongs to no one. */

export const esc = (value: unknown) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** JSON for a <script type="application/json|ld+json"> block: nothing in it can close the tag. */
export const scriptJson = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");

export const STYLE = `
:root{--bg:#eef1f4;--card:#fff;--ink:#16202e;--muted:#5a6675;--faint:#7d8896;--line:#dce2e9;--accent:#2446d8;--accent-ink:#fff;--soft:#f1f4f8;--tint:#e8edfd;
--shadow:0 1px 2px rgba(22,32,46,.04),0 10px 30px -18px rgba(22,32,46,.18);--radius:20px;
--glow-1:rgb(36 70 216 / .16);--glow-2:rgb(124 92 255 / .13);--glow-3:rgb(40 190 225 / .12);--font:"Bricolage Grotesque",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color-scheme:light dark}
@media (prefers-color-scheme:dark){:root{--bg:#121821;--card:#1a222d;--ink:#e8edf3;--muted:#9aa6b4;--faint:#748191;--line:#2a3441;--accent:#7c93ff;--accent-ink:#0e1522;--soft:#212a36;--tint:#1f2a4a;
--shadow:none;--glow-1:rgb(61 91 255 / .26);--glow-2:rgb(139 107 255 / .20);--glow-3:rgb(43 179 217 / .16)}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 var(--font);font-optical-sizing:auto;-webkit-font-smoothing:antialiased;overflow-x:clip;position:relative;isolation:isolate}
body::before{content:"";position:absolute;z-index:-1;top:-160px;right:0;width:min(980px,100%);height:760px;pointer-events:none;filter:blur(10px);
background:radial-gradient(closest-side at 38% 42%,var(--glow-2),transparent 72%),radial-gradient(closest-side at 64% 36%,var(--glow-1),transparent 70%),radial-gradient(closest-side at 72% 66%,var(--glow-3),transparent 70%)}
a{color:var(--accent);text-decoration-thickness:1px;text-underline-offset:.2em}:focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:6px}
header.bar{position:sticky;top:0;z-index:1000}
header.bar::before{content:"";position:absolute;inset:0;z-index:-1;background:color-mix(in srgb,var(--bg) 86%,transparent);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid color-mix(in srgb,var(--line) 70%,transparent)}
.top{max-width:1240px;margin:0 auto;padding:12px 24px;display:flex;align-items:center;gap:20px}
.brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:var(--ink);white-space:nowrap}.brand svg{flex:none}
.brand b{font-weight:700;font-size:18px;letter-spacing:-.01em}.brand span{font-size:12.5px;color:var(--muted);font-weight:500;display:block;line-height:1}
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
@media (max-width:720px){.top{padding:10px 16px;gap:10px}nav.main a.cal{display:none}.brand b{max-width:46vw;overflow:hidden;text-overflow:ellipsis;display:block}.brand span{display:none}nav.main a{padding:7px 10px;font-size:14px}main{padding:22px 16px 56px}footer.site{padding:24px 16px 40px}.card{padding:20px 18px}}`;

/** A mark of concentric rings - the radius on the map - in the accent colour. */
const MARK = `<svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true"><circle cx="17" cy="17" r="15.5" fill="none" stroke="var(--accent)" stroke-width="1.5" opacity=".35"/>
<circle cx="17" cy="17" r="10" fill="none" stroke="var(--accent)" stroke-width="1.5" opacity=".65"/><circle cx="17" cy="17" r="4.5" fill="var(--accent)"/></svg>`;

export type PageOptions = {
  title: string; description: string; path: string; body: string; section?: "kalender" | "arrangorer" | "om" | null; regionSlug?: string; regionName?: string;
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
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300..700&display=swap">${o.head ?? ""}
<style>${STYLE}</style></head><body>
<header class="bar"><div class="top"><a class="brand" href="/${esc(region)}">${MARK}<div><b>${esc(name)}</b><span>${esc(o.regionName ?? "Østjylland")}</span></div></a>
<nav class="main" aria-label="Menu">${nav("kalender", `/${esc(region)}`, "Kalender", "cal")}${nav("arrangorer", `/${esc(region)}/arrangorer`, "Arrangører")}${nav("om", "/om", "Om")}</nav></div></header>
${o.body}
<footer class="site"><span>${esc(name)} er en uafhængig oversigt. Alt kommer fra arrangørernes egne kalendere, og tilmelding sker altid hos arrangøren.</span>
<a href="/om#med">Få jeres events med →</a></footer>${(o.scripts ?? []).map(src => `<script src="${esc(src)}" defer></script>`).join("")}</body></html>`;
}

export const HTML_HEADERS: Record<string, string> = {
  "content-type": "text/html; charset=utf-8",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "content-security-policy": "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
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
