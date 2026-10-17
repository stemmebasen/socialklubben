import { describe, expect, it } from "vitest";
import { handle } from "./app.js";
import { eventTime, extractEvents, findFeed, robotsAllow, runScanner } from "./scan.js";
import { fakeWeb, NOW, testDatabase, testDeps, testEnv } from "./test-support.js";

// The scanner finds events on organizers' websites and takes visitors' tips; nothing it finds is shown
// before the administration approves it.

const ORIGIN = "https://portal.example";
const ld = (data: unknown) => `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
const STUDIO_PAGE = `<html><head><link rel="alternate" type="text/calendar" title="Kalender" href="/kalender.ics"></head><body>
${ld({ "@context": "https://schema.org", "@graph": [
  { "@type": "Organization", name: "Studie Ro" },
  { "@type": "Event", name: "Yin yoga &amp; ro", startDate: "2026-10-05T19:00:00+02:00", endDate: "2026-10-05T20:30:00+02:00", url: "/events/yin",
    location: { "@type": "Place", name: "Studie Ro", address: { "@type": "PostalAddress", streetAddress: "Mejlgade 30", postalCode: "8000", addressLocality: "Aarhus C" } },
    offers: { "@type": "Offer", price: "150", priceCurrency: "DKK" }, organizer: { "@type": "Organization", name: "Studie Ro" }, image: ["https://studie.example/yin.jpg"] },
  { "@type": "EducationEvent", name: "Meditationskursus", startDate: "2026-10-12T10:00", description: "<p>Fire lørdage.</p>", eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode" },
  { "@type": "Event", name: "Aflyst lydbad", startDate: "2026-10-06T19:00:00+02:00", eventStatus: "https://schema.org/EventCancelled" },
  { "@type": "Event", name: "Kakaoceremoni", startDate: "2026-10-03T19:00:00+02:00", location: "Guldsmedgade 26B, 8000 Aarhus C" }
] })}
${ld([{ "@type": "Event", name: "Retreat", startDate: "2026-10-16", endDate: "2026-10-18" }])}
<script type="application/ld+json">{ broken</script></body></html>`;

describe("reading a page", () => {
  it("takes the schema.org events a page states, and nothing it does not", () => {
    const found = extractEvents(STUDIO_PAGE, "https://studie.example/events");
    expect(found.map(f => f.title)).toEqual(["Yin yoga & ro", "Meditationskursus", "Kakaoceremoni", "Retreat"]);
    expect(found[0]).toMatchObject({ startsAtMs: Date.parse("2026-10-05T17:00:00Z"), endsAtMs: Date.parse("2026-10-05T18:30:00Z"), allDay: false,
      location: "Studie Ro, Mejlgade 30, 8000 Aarhus C", link: "https://studie.example/events/yin", priceMinor: 15000, organizer: "Studie Ro", imageUrl: "https://studie.example/yin.jpg" });
    // No offset: Copenhagen time. Online stays online. No price stated: none.
    expect(found[1]).toMatchObject({ startsAtMs: Date.parse("2026-10-12T08:00:00Z"), location: "Online", description: "Fire lørdage.", priceMinor: null, endsAtMs: null });
    // A date without a time is all day; the last day is included.
    expect(found[3]).toMatchObject({ allDay: true, startsAtMs: Date.parse("2026-10-15T22:00:00Z"), endsAtMs: Date.parse("2026-10-18T22:00:00Z") });
    expect(eventTime("20. oktober")).toBeNull();
  });

  it("finds a calendar address on the page", () => {
    expect(findFeed(STUDIO_PAGE, "https://studie.example/events")).toBe("https://studie.example/kalender.ics");
    expect(findFeed(`<a href="webcal://cal.example/ro.ics">Abonnér</a>`, "https://studie.example/")).toBe("https://cal.example/ro.ics");
    // A blog's RSS is not a calendar.
    expect(findFeed(`<link rel="alternate" type="application/rss+xml" title="Blog" href="/feed">`, "https://studie.example/")).toBeNull();
  });

  it("does as robots.txt asks", () => {
    const robots = "User-agent: *\nDisallow: /admin\nDisallow: /events/private\nAllow: /events/private/open\n\nUser-agent: Googlebot\nDisallow: /";
    expect(robotsAllow(robots, "/events")).toBe(true);
    expect(robotsAllow(robots, "/admin/x")).toBe(false);
    expect(robotsAllow(robots, "/events/private/x")).toBe(false);
    expect(robotsAllow(robots, "/events/private/open/1")).toBe(true);
    expect(robotsAllow("User-agent: socialklubben-scanner\nDisallow: /\n\nUser-agent: *\nDisallow:", "/events")).toBe(false);
    expect(robotsAllow("User-agent: *\nDisallow: /*.pdf$", "/a.pdf")).toBe(false);
  });
});

const form = (fields: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(fields)) f.append(k, v); return f; };

async function setup(pages: Record<string, string | ((url: string) => Response)>) {
  const db = testDatabase();
  const env = testEnv(db);
  const { fetcher, calls } = fakeWeb({
    ...pages,
    "https://nominatim.openstreetmap.org/search?": () => new Response(JSON.stringify([{ lat: "56.1595", lon: "10.2135" }]))
  });
  const deps = testDeps(fetcher);
  const call = (path: string, init: RequestInit & { cookie?: string; ip?: string } = {}) => handle(new Request(ORIGIN + path, { ...init, redirect: "manual",
    headers: { ...(init.method === "POST" ? { origin: ORIGIN } : {}), ...(init.cookie ? { cookie: init.cookie } : {}), ...(init.ip ? { "cf-connecting-ip": init.ip } : {}) } }), env, deps);
  const cookie = ((await call("/admin/login", { method: "POST", body: form({ password: "hemmelig-test" }) })).headers.get("set-cookie") ?? "").split(";")[0]!;
  return { db, env, deps, calls, call, cookie };
}

describe("the scanner", () => {
  it("queues what a site's page states, once, and shows a find only after it is approved", async () => {
    const { db, env, deps, call, cookie, calls } = await setup({ "https://studie.example/robots.txt": "User-agent: *\nDisallow: /admin", "https://studie.example/events": STUDIO_PAGE });
    expect((await call("/admin/scanner", { method: "POST", cookie, body: form({ url: "studie.example/events", name: "Studie Ro" }) })).headers.get("location")).toBe("/admin/scanner?besked=tilfoejet");
    const sites = await (await call("/admin/scanner", { cookie })).text();
    expect(sites).toContain("4 kommende events på siden · 4 nye i køen · kalenderadresse fundet");
    expect(sites).toContain("Tilføj som arrangør");
    // Nothing is on the site yet.
    expect(await (await call("/ostjylland/planlaeg?nar=alle")).text()).not.toContain("Yin yoga");
    const queue = await (await call("/admin/fund", { cookie })).text();
    expect(queue).toContain("Scanner: Studie Ro");
    expect(queue).toContain("Mejlgade 30, 8000 Aarhus C");
    expect(queue).toContain("150 kr.");
    // Read again a week later: the same finds are not queued twice.
    await runScanner(env, { ...deps, now: () => NOW + 8 * 86_400_000 - 3 * 86_400_000 });
    expect((await db.prepare("SELECT COUNT(*) AS n FROM candidates").first<{ n: number }>())!.n).toBe(4);
    expect(calls.filter(c => c === "https://studie.example/events").length).toBeGreaterThanOrEqual(1);

    const yin = await db.prepare("SELECT id FROM candidates WHERE title LIKE 'Yin%'").first<{ id: number }>();
    const approved = await call(`/admin/fund/${yin!.id}`, { method: "POST", cookie, body: form({ action: "approve", source: "ny", new_name: "Studie Ro", topic: "krop-sind", address: "" }) });
    expect(approved.headers.get("location")).toBe("/admin/fund?besked=vist");
    const plan = await (await call("/ostjylland/planlaeg?nar=alle")).text();
    expect(plan).toContain(">Yin yoga &amp; ro<");
    expect(await db.prepare("SELECT kind, website FROM sources WHERE name = 'Studie Ro'").first()).toEqual({ kind: "manual", website: "https://studie.example/" });
    // The next find from the same organizer goes to the same organizer.
    const kakao = await db.prepare("SELECT id FROM candidates WHERE title = 'Kakaoceremoni'").first<{ id: number }>();
    await call(`/admin/fund/${kakao!.id}`, { method: "POST", cookie, body: form({ action: "approve", source: "ny", new_name: "studie ro", topic: "krop-sind" }) });
    expect((await db.prepare("SELECT COUNT(*) AS n FROM sources").first<{ n: number }>())!.n).toBe(1);
    const retreat = await db.prepare("SELECT id FROM candidates WHERE title = 'Retreat'").first<{ id: number }>();
    await call(`/admin/fund/${retreat!.id}`, { method: "POST", cookie, body: form({ action: "reject" }) });
    expect(await (await call("/admin/fund", { cookie })).text()).not.toContain("Retreat");
  });

  it("marks a find that looks like an event already shown, and does not read a page robots.txt closes", async () => {
    const page = `${ld({ "@type": "Event", name: "Yin Yoga & Ro!", startDate: "2026-10-05T19:15:00+02:00" })}`;
    const { db, call, cookie } = await setup({ "https://a.example/robots.txt": "", "https://a.example/": page, "https://b.example/robots.txt": "User-agent: *\nDisallow: /", "https://b.example/": page });
    await db.prepare("INSERT INTO sources (name, feed_url, default_topic, created_at_ms, updated_at_ms) VALUES ('X', 'https://x.example/cal.ics', 'krop-sind', 0, 0)").run();
    await db.prepare(`INSERT INTO events (source_id, source_uid, title, starts_at_ms, topic, content_hash, first_seen_at_ms, updated_at_ms) VALUES (1, 'y', 'Yin yoga & ro', ?, 'krop-sind', 'x', 0, 0)`)
      .bind(Date.parse("2026-10-05T17:00:00Z")).run();
    await call("/admin/scanner", { method: "POST", cookie, body: form({ url: "https://a.example/" }) });
    expect(await (await call("/admin/fund", { cookie })).text()).toContain("Ligner et event, der allerede vises");
    await call("/admin/scanner", { method: "POST", cookie, body: form({ url: "https://b.example/" }) });
    expect(await (await call("/admin/scanner", { cookie })).text()).toContain("robots.txt");
    expect((await db.prepare("SELECT COUNT(*) AS n FROM candidates").first<{ n: number }>())!.n).toBe(1);
  });

  it("takes visitors' tips into the queue, and turns away robots and floods", async () => {
    const { db, call, cookie } = await setup({});
    expect(await (await call("/tip")).text()).toContain("Tip et event");
    const tip = { title: "Fællessang på biblioteket", date: "2026-10-09", time: "17.00", end: "18.30", place: "Dokk1, Hack Kampmanns Plads 2, 8000 Aarhus C", organizer: "Dokk1",
      link: "dokk1.example/sang", description: "Gratis entré.", contact: "Tipper@Example.dk" };
    const sent = await call("/tip", { method: "POST", body: form(tip), ip: "1.2.3.4" });
    expect(sent.headers.get("location")).toBe("/tip?tak=1");
    expect(await db.prepare("SELECT title, starts_at_ms, ends_at_ms, link, price_minor, contact, origin FROM candidates").first()).toEqual({ title: "Fællessang på biblioteket",
      starts_at_ms: Date.parse("2026-10-09T15:00:00Z"), ends_at_ms: Date.parse("2026-10-09T16:30:00Z"), link: "https://dokk1.example/sang", price_minor: 0, contact: "tipper@example.dk", origin: "tip" });
    expect(await (await call("/admin/fund", { cookie })).text()).toContain("Tip fra tipper@example.dk");
    // The contact is never on the public site.
    expect((await call("/tip", { method: "POST", body: form({ ...tip, title: "" }), ip: "1.2.3.4" })).status).toBe(400);
    expect(await (await call("/tip", { method: "POST", body: form({ ...tip, date: "2028-01-01" }), ip: "1.2.3.4" })).text()).toContain("det næste halve år");
    await call("/tip", { method: "POST", body: form({ ...tip, title: "Robot", hjemmeside: "spam" }), ip: "1.2.3.4" });
    expect(await db.prepare("SELECT COUNT(*) AS n FROM candidates WHERE title = 'Robot'").first()).toEqual({ n: 0 });
    for (let i = 0; i < 4; i++) await call("/tip", { method: "POST", body: form({ ...tip, title: `Tip ${i}` }), ip: "1.2.3.4" });
    expect(await (await call("/tip", { method: "POST", body: form({ ...tip, title: "For meget" }), ip: "1.2.3.4" })).text()).toContain("mange tips");
    const elsewhere = await handle(new Request(ORIGIN + "/tip", { method: "POST", body: form(tip), headers: { origin: "https://evil.example" } }), testEnv(db), testDeps(fakeWeb({}).fetcher));
    expect(elsewhere.status).toBe(403);
  });
});
