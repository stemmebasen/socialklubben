import { describe, expect, it } from "vitest";
import { handle } from "./app.js";
import { geocodePending } from "./geocode.js";
import { runSourceSync } from "./sources.js";
import { window } from "./events.js";
import { fakeWeb, NOW, testDatabase, testDeps, testEnv } from "./test-support.js";

// The portal: a neutral overview of what goes on within spirituality, personal development and mental
// health in Østjylland - Hjerterum's events and its partners' alike - with a map and a radius.

const ORIGIN = "https://portal.example";
const HJERTERUM_RSS = "https://api.membershipworks.com/v2/events?_op=rss&org=22308";
const YOGA_ICS = "https://yogahuset.example/kalender.ics";
const rss = `<?xml version="1.0"?><rss><channel>
<item><guid>hj-1</guid><title>Kakaoceremoni</title><link>https://holistisk.org/events/#!event/hj-1</link><ev:startdate>2026-10-03T19:00:00+02:00</ev:startdate>
<ev:enddate>2026-10-03T21:00:00+02:00</ev:enddate><ev:location>Hjerterum</ev:location><description>Pris: 150 kr.</description></item>
<item><guid>hj-2</guid><title>Lydbad med gongs &lt;3 &amp; "ro"</title><ev:startdate>2026-10-08T19:00:00+02:00</ev:startdate><ev:location>Hjerterum</ev:location></item>
</channel></rss>`;
const ics = ["BEGIN:VCALENDAR", "VERSION:2.0",
  "BEGIN:VEVENT", "UID:yin", "SUMMARY:Yin yoga workshop", "DTSTART;TZID=Europe/Copenhagen:20261002T190000", "DTEND;TZID=Europe/Copenhagen:20261002T210000",
  "LOCATION:Yogahuset\\, Søndergade 5\\, 8600 Silkeborg", "URL:https://yogahuset.example/yin", "DESCRIPTION:Lange stræk og ro.\\nPris: 250 kr.", "END:VEVENT",
  "BEGIN:VEVENT", "UID:online", "SUMMARY:Mindfulness online", "DTSTART;TZID=Europe/Copenhagen:20261006T190000", "LOCATION:Online via Zoom", "END:VEVENT",
  "BEGIN:VEVENT", "UID:kbh", "SUMMARY:Meditation i København", "DTSTART;TZID=Europe/Copenhagen:20261007T190000", "LOCATION:Nørrebrogade 1\\, 2200 København", "END:VEVENT",
  "END:VCALENDAR"].join("\r\n");
const PLACES: Record<string, [number, number]> = { Guldsmedgade: [56.1586, 10.2105], Silkeborg: [56.1697, 9.5451], "Nørrebrogade": [55.6905, 12.5539] };
const web = () => fakeWeb({
  [HJERTERUM_RSS]: rss, [YOGA_ICS]: ics,
  "https://nominatim.openstreetmap.org/search?": url => {
    const hit = Object.entries(PLACES).find(([word]) => decodeURIComponent(url).includes(word));
    return new Response(JSON.stringify(hit ? [{ lat: String(hit[1][0]), lon: String(hit[1][1]) }] : []));
  }
});
const form = (fields: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(fields)) f.append(k, v); return f; };

async function setup() {
  const db = testDatabase();
  const env = testEnv(db, { CONTACT_EMAIL: "hej@portal.example" });
  const { fetcher, calls } = web();
  const deps = testDeps(fetcher);
  const call = (path: string, init: RequestInit & { cookie?: string } = {}) => handle(new Request(ORIGIN + path, { ...init, redirect: "manual",
    headers: { ...(init.method === "POST" ? { origin: ORIGIN } : {}), ...(init.cookie ? { cookie: init.cookie } : {}), ...(init.headers as Record<string, string> | undefined ?? {}) } }), env, deps);
  const login = async () => ((await call("/admin/login", { method: "POST", body: form({ password: "hemmelig-test" }) })).headers.get("set-cookie") ?? "").split(";")[0]!;
  return { db, env, deps, calls, call, login };
}

async function withTwoOrganizers() {
  const s = await setup();
  const cookie = await s.login();
  await s.call("/admin/kilder", { method: "POST", cookie, body: form({ name: "Hjerterum", website: "holistisk.org", feed_url: HJERTERUM_RSS, default_topic: "cirkler",
    default_address: "Guldsmedgade 26B, 8000 Aarhus C" }) });
  await s.call("/admin/kilder", { method: "POST", cookie, body: form({ name: "Yogahuset", website: "yogahuset.example", feed_url: YOGA_ICS, default_topic: "krop" }) });
  await geocodePending(s.env, s.deps);
  return { ...s, cookie };
}

describe("the portal", () => {
  it("keeps the administration closed without the password", async () => {
    const { call } = await setup();
    expect((await call("/admin")).status).toBe(401);
    expect((await call("/admin/login", { method: "POST", body: form({ password: "forkert" }) })).status).toBe(401);
    expect((await call("/admin/kilder", { method: "POST", body: form({ name: "X" }) })).status).toBe(401);
    const cross = await call("/admin/login", { method: "POST", body: form({ password: "hemmelig-test" }), headers: { origin: "https://evil.example" } } as RequestInit);
    expect(cross.status).toBe(403);
    const closed = await handle(new Request(ORIGIN + "/admin"), testEnv(testDatabase(), { ADMIN_PASSWORD: "" }), testDeps(web().fetcher));
    expect(closed.status).toBe(503);
  });

  it("shows every organizer's coming events alike, by time, with theme, place and price", async () => {
    const { call } = await withTwoOrganizers();
    const response = await call("/ostjylland/planlaeg?nar=alle");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy")).toContain("script-src 'self'");
    const text = await response.text();
    const order = ["Yin yoga workshop", "Kakaoceremoni", "Mindfulness online", "Lydbad med gongs"].map(t => text.indexOf(t));
    expect(order.every((at, i) => at > 0 && (i === 0 || at > order[i - 1]!))).toBe(true);
    // Outside the region: an event in Copenhagen belongs to another region's page.
    expect(text).not.toContain("Meditation i København");
    expect(text).toContain("Guldsmedgade 26B, 8000 Aarhus C · 150 kr.");
    expect(text).toContain("lør. 19.00 · Spiritualitet");
    // Text from a calendar is never markup.
    expect(text).not.toContain("gongs <3");
    expect(text).toContain("Lydbad med gongs &lt;3 &amp; &quot;ro&quot;");
  });

  it("filters by theme, time and distance from a town or the visitor", async () => {
    const { call } = await withTwoOrganizers();
    const titles = async (path: string) => [...(await (await call(path)).text()).matchAll(/class="row-title">([^<]+)</g)].map(m => m[1]);
    expect(await titles("/ostjylland/planlaeg?nar=alle&tema=krop")).toEqual(["Yin yoga workshop"]);
    expect(await titles("/ostjylland/planlaeg?nar=alle&by=aarhus&km=10")).toEqual(["Kakaoceremoni", "Lydbad med gongs &lt;3 &amp; &quot;ro&quot;"]);
    expect(await titles("/ostjylland/planlaeg?nar=alle&by=silkeborg&km=5")).toEqual(["Yin yoga workshop"]);
    expect(await titles("/ostjylland/planlaeg?nar=alle&by=silkeborg&km=50")).toHaveLength(3);
    expect(await titles("/ostjylland/planlaeg?nar=idag")).toEqual([]);
    expect(await titles("/ostjylland/planlaeg?nar=weekend")).toEqual(["Yin yoga workshop", "Kakaoceremoni"]);
    const near = await call("/ostjylland/planlaeg?nar=alle&by=naer&lat=56.157&lng=10.211&km=5");
    expect(near.headers.get("cache-control")).toBe("private, no-store");
    expect(await near.text()).toContain("Det sker nær dig");
    // A position outside Denmark is ignored.
    expect(await (await call("/ostjylland/planlaeg?by=naer&lat=40&lng=10&km=5")).text()).toContain("Det sker i Østjylland");
  });

  it("shows one event with its place, schema.org data and the way on to the organizer, and counts the click", async () => {
    const { call, db, cookie } = await withTwoOrganizers();
    const yin = await db.prepare("SELECT id FROM events WHERE source_uid = 'yin'").first<{ id: number }>();
    expect((await call(`/ostjylland/e/${yin!.id}`)).headers.get("location")).toBe(`/ostjylland/e/${yin!.id}-yin-yoga-workshop`);
    const text = await (await call(`/ostjylland/e/${yin!.id}-yin-yoga-workshop`)).text();
    const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(text)![1]!);
    expect(ld).toMatchObject({ "@type": "Event", name: "Yin yoga workshop", startDate: "2026-10-02T17:00:00.000Z", organizer: { name: "Yogahuset" },
      location: { "@type": "Place", geo: { latitude: 56.1697 } }, offers: { price: "250.00", priceCurrency: "DKK" } });
    expect(text).toContain(`href="/ud/${yin!.id}"`);
    const out = await call(`/ud/${yin!.id}`);
    expect(out.status).toBe(302);
    expect(out.headers.get("location")).toBe("https://yogahuset.example/yin");
    expect(await (await call("/admin", { cookie })).text()).toContain("1 klik videre (30 dage)");
    expect((await call("/ud/99999")).status).toBe(404);
  });

  it("lists the organizers alphabetically, and has an about page, robots.txt and a sitemap", async () => {
    const { call, db } = await withTwoOrganizers();
    const organizers = await (await call("/ostjylland/arrangorer")).text();
    expect(organizers.indexOf("Hjerterum")).toBeLessThan(organizers.indexOf("Yogahuset"));
    expect(organizers).toContain("2 kommende");
    const about = await (await call("/om")).text();
    expect(about).toContain("tilhører ingen bestemt forening");
    expect(about).toContain("udvalgt efter relevans og kvalitet");
    expect(about).toContain("mailto:hej@portal.example");
    expect(await (await call("/robots.txt")).text()).toContain("Disallow: /admin");
    expect((await (await call("/sitemap.xml")).text()).match(/<loc>/g)!.length).toBe(4 + 4);
    expect((await call("/")).headers.get("location")).toBe("/ostjylland");
    expect(await (await call("/health")).json()).toEqual({ status: "ok", database: "ready" });
    expect((await call("/kbh")).status).toBe(404);
    const kbh = await db.prepare("SELECT id FROM events WHERE source_uid = 'kbh'").first<{ id: number }>();
    expect((await call(`/ostjylland/e/${kbh!.id}-meditation-i-kobenhavn`)).status).toBe(404);
  });

  it("lets the administration hide one event, pause an organizer and set a place by hand", async () => {
    const { call, db, cookie } = await withTwoOrganizers();
    const yoga = await db.prepare("SELECT id FROM sources WHERE name = 'Yogahuset'").first<{ id: number }>();
    const yin = await db.prepare("SELECT id FROM events WHERE source_uid = 'yin'").first<{ id: number }>();
    const detail = await (await call(`/admin/kilder/${yoga!.id}`, { cookie })).text();
    expect(detail).toContain("Hentet");
    expect(detail).toContain("3 kommende events (iCal)");
    await call(`/admin/kilder/${yoga!.id}`, { method: "POST", cookie, body: form({ action: "hide", event: String(yin!.id) }) });
    expect(await (await call("/ostjylland/planlaeg?nar=alle")).text()).not.toContain("Yin yoga workshop");
    expect((await call(`/ostjylland/e/${yin!.id}-yin-yoga-workshop`)).status).toBe(404);
    await call(`/admin/kilder/${yoga!.id}`, { method: "POST", cookie, body: form({ action: "pause" }) });
    expect(await (await call("/ostjylland/planlaeg?nar=alle")).text()).not.toContain("Mindfulness online");
    const venue = await db.prepare("SELECT id FROM venues WHERE address LIKE '%Silkeborg%'").first<{ id: number }>();
    const set = await call(`/admin/steder/${venue!.id}`, { method: "POST", cookie, body: form({ action: "set", coords: "56,17; 9,55" }) });
    expect(set.headers.get("location")).toBe("/admin/steder?besked=sat");
    expect(await db.prepare("SELECT lat, lng, status FROM venues WHERE id = ?").bind(venue!.id).first()).toEqual({ lat: 56.17, lng: 9.55, status: "manual" });
    const bad = await call(`/admin/kilder`, { method: "POST", cookie, body: form({ name: "X", feed_url: "ftp://x", default_topic: "krop" }) });
    expect(bad.status).toBe(400);
  });

  it("reads every active calendar from the cron, once an hour", async () => {
    const { env, deps, calls } = await withTwoOrganizers();
    const before = calls.length;
    await runSourceSync(env, deps);
    await runSourceSync(env, { ...deps, now: () => NOW + 10 * 60_000 });
    expect(calls.slice(before).filter(c => c === HJERTERUM_RSS || c === YOGA_ICS)).toHaveLength(2);
    await runSourceSync(env, { ...deps, now: () => NOW + 3_600_000 });
    expect(calls.slice(before).filter(c => c === HJERTERUM_RSS || c === YOGA_ICS)).toHaveLength(4);
  });

  it("opens on Udforsk: the next 14 days as bars, the chosen day's events as cards, and the map's data", async () => {
    const { call } = await withTwoOrganizers();
    const text = await (await call("/ostjylland")).text();
    expect(text.match(/data-day="/g)).toHaveLength(14);
    expect(text).toContain('aria-label="I dag: 0 events"');
    expect(text).toContain('aria-label="I morgen: 1 events"');
    const data = JSON.parse(/<script type="application\/json" id="explore-data">([\s\S]*?)<\/script>/.exec(text)![1]!);
    expect(data.events.map((e: { t: string }) => e.t)).toEqual(["Yin yoga workshop", "Kakaoceremoni", "Mindfulness online", "Lydbad med gongs <3 & \"ro\""]);
    expect(data.events[0]).toMatchObject({ k: "krop", h: "19.00", v: "kort", p: 25000, d: [1] });
    // Lydbad has no end in its calendar, so its length is not guessed.
    expect(data.events[3].v).toBeNull();
    // A day, a theme and "free" are in the address and work without the map script.
    const saturday = await (await call("/ostjylland?dag=2026-10-03")).text();
    expect(saturday).toContain('<h2><a href="/ostjylland/e/');
    expect(saturday).toContain(">Kakaoceremoni</a>");
    expect(saturday).not.toContain(">Yin yoga workshop</a>");
    expect(await (await call("/ostjylland?dag=2026-10-03&slags=online")).text()).toContain("Ingen events lør. 3. med de valg");
    expect(await (await call("/ostjylland?dag=2026-10-02&tema=krop&varighed=kort")).text()).toContain(">Yin yoga workshop</a>");
    // Links to the list from before Udforsk go on to Planlæg.
    expect((await call("/ostjylland?nar=alle&tema=krop")).headers.get("location")).toBe("/ostjylland/planlaeg?nar=alle&tema=krop");
  });

  it("shows a series once in Planlæg with its other dates, and lists them on the event's page", async () => {
    const { call, db } = await withTwoOrganizers();
    const yin = await db.prepare("SELECT * FROM events WHERE source_uid = 'yin'").first<Record<string, unknown>>();
    const week = 7 * 86_400_000;
    await db.prepare(`INSERT INTO events (source_id, source_uid, title, starts_at_ms, ends_at_ms, venue_id, topic, content_hash, first_seen_at_ms, updated_at_ms)
      VALUES (?, 'yin-2', 'Yin yoga workshop', ?, ?, ?, 'krop', 'x', 0, 0)`).bind(yin!.source_id, Number(yin!.starts_at_ms) + week, Number(yin!.ends_at_ms) + week, yin!.venue_id).run();
    const plan = await (await call("/ostjylland/planlaeg?nar=alle")).text();
    expect(plan.match(/>Yin yoga workshop</g)).toHaveLength(1);
    expect(plan).toContain('<span class="more">+1 dato</span>');
    const page = await (await call(`/ostjylland/e/${yin!.id}-yin-yoga-workshop`)).text();
    expect(page).toContain("Flere datoer");
    expect(page).toContain("fredag 9. oktober kl. 19.00");
    expect(page).toContain(`data-save="${yin!.id}"`);
  });

  it("searches the coming events, and shows only the saved events it is asked for", async () => {
    const { call, db } = await withTwoOrganizers();
    const titles = async (path: string) => [...(await (await call(path)).text()).matchAll(/class="row-title">([^<]+)</g)].map(m => m[1]);
    expect(await titles("/ostjylland/sog?q=yin")).toEqual(["Yin yoga workshop"]);
    // The organizer's name counts too.
    expect(await titles("/ostjylland/sog?q=yogahuset")).toEqual(["Yin yoga workshop", "Mindfulness online"]);
    expect(await titles("/ostjylland/sog?q=Silkeborg")).toEqual(["Yin yoga workshop"]);
    expect(await titles("/ostjylland/sog?q=hjerterum%20lydbad")).toEqual(["Lydbad med gongs &lt;3 &amp; &quot;ro&quot;"]);
    expect(await titles("/ostjylland/sog?q=%25")).toEqual([]);
    expect(await (await call("/ostjylland/sog?q=qwerty")).text()).toContain("Intet fundet");
    expect(await (await call("/ostjylland/sog")).text()).toContain("vælg et tema");
    const kakao = await db.prepare("SELECT id FROM events WHERE source_uid = 'hj-1'").first<{ id: number }>();
    const saved = await call(`/ostjylland/gemt?ids=${kakao!.id},99999,abc`);
    expect(saved.headers.get("cache-control")).toBe("private, no-store");
    const text = await saved.text();
    expect([...text.matchAll(/class="row-title">([^<]+)</g)].map(m => m[1])).toEqual(["Kakaoceremoni"]);
    expect(text).toContain(`data-found="${kakao!.id}"`);
    expect(await (await call("/ostjylland/gemt")).text()).toContain("Intet gemt endnu");
  });

  it("knows Copenhagen's days and weekends", () => {
    const thursday = Date.parse("2026-10-01T10:00:00Z");
    expect(new Date(window("idag", thursday).to).toISOString()).toBe("2026-10-01T22:00:00.000Z");
    expect(Object.values(window("weekend", thursday)).map(ms => new Date(ms).toISOString())).toEqual(["2026-10-02T14:00:00.000Z", "2026-10-04T22:00:00.000Z"]);
    const saturday = Date.parse("2026-10-03T09:00:00Z");
    expect(window("weekend", saturday).from).toBe(saturday);
    // Winter time: the last Sunday of October.
    expect(new Date(window("weekend", Date.parse("2026-10-21T10:00:00Z")).to).toISOString()).toBe("2026-10-25T23:00:00.000Z");
  });
});
