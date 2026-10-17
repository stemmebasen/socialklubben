import { describe, expect, it } from "vitest";
import { createSource, getSource, runSourceSync, setEventHidden, setSourceStatus, sourceInput, syncSource, type SourceInput } from "./sources.js";
import { geocodePending, setVenueByHand } from "./geocode.js";
import { fakeWeb, NOW, testDatabase, testDeps, testEnv } from "./test-support.js";
import type { D1Database } from "./db.js";

const FEED = "https://yogahuset.example/kalender.ics";
const ics = (...events: string[]) => ["BEGIN:VCALENDAR", "VERSION:2.0", ...events, "END:VCALENDAR"].join("\r\n");
const vevent = (uid: string, title: string, start: string, ...extra: string[]) =>
  ["BEGIN:VEVENT", `UID:${uid}`, `SUMMARY:${title}`, `DTSTART;TZID=Europe/Copenhagen:${start}`, ...extra, "END:VEVENT"].join("\r\n");
const input = (extra: Partial<SourceInput> = {}): SourceInput => ({ name: "Yogahuset", website: "https://yogahuset.example/", feedUrl: FEED,
  defaultAddress: "Vestergade 10, 8000 Aarhus C", defaultTopic: "krop-sind", includeWords: null, excludeWords: null, contactEmail: null, note: null, ...extra });
const rows = async (db: D1Database) => (await db.prepare(`SELECT e.title, e.topic, e.price_minor, e.online, e.removed_at_ms IS NOT NULL AS removed, v.address
  FROM events e LEFT JOIN venues v ON v.id = e.venue_id ORDER BY e.starts_at_ms`).all<Record<string, unknown>>()).results ?? [];

function calendar(initial: string) {
  const state = { body: initial, status: 200 };
  const web = fakeWeb({ [FEED]: () => new Response(state.body, { status: state.status }) });
  return { state, ...web };
}

describe("an organizer's calendar in the portal", () => {
  it("reads the administration's form and refuses what cannot work", () => {
    const form = (fields: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(fields)) f.append(k, v); return f; };
    expect(sourceInput(form({ name: " Yogahuset ", feed_url: "webcal://yogahuset.example/k.ics", default_topic: "krop-sind", website: "yogahuset.example" })))
      .toMatchObject({ ok: true, value: { name: "Yogahuset", feedUrl: "https://yogahuset.example/k.ics", website: "https://yogahuset.example/" } });
    expect(sourceInput(form({ name: "X", feed_url: "http://x.example/k.ics", default_topic: "krop-sind" }))).toMatchObject({ ok: false });
    expect(sourceInput(form({ name: "X", feed_url: "https://x.example/k.ics", default_topic: "golf" }))).toEqual({ ok: false, error: "Vælg den kategori, arrangøren oftest har." });
    expect(sourceInput(form({ name: "", feed_url: "https://x.example/k.ics", default_topic: "krop-sind" }))).toEqual({ ok: false, error: "Skriv arrangørens navn." });
  });

  it("brings the coming events in with theme, price and place, and leaves out what is past, far ahead, private or repeating", async () => {
    const db = testDatabase();
    const id = await createSource(db, input(), NOW);
    const { fetcher } = calendar(ics(
      vevent("a", "Yin yoga workshop", "20261015T190000", "DESCRIPTION:Pris: 250 kr.", "LOCATION:Yogahuset, Vestergade 10, 8000 Aarhus C"),
      vevent("b", "Lydbad", "20261020T190000", "LOCATION:Yogahuset"),
      vevent("c", "Mindfulness online", "20261022T190000", "LOCATION:Online via Zoom"),
      vevent("past", "Sidste måned", "20260901T190000"), vevent("far", "Om et år", "20271001T190000"),
      vevent("weekly", "Ugentlig yoga", "20261005T170000", "RRULE:FREQ=WEEKLY"), vevent("private", "Bestyrelsesmøde", "20261005T170000", "CLASS:PRIVATE")));
    expect(await syncSource(db, testDeps(fetcher), (await getSource(db, id))!)).toMatchObject({ ok: true, coming: 3, written: 3,
      message: "3 kommende events (iCal) · 1 gentagen serie vises ikke endnu" });
    expect(await rows(db)).toEqual([
      { title: "Yin yoga workshop", topic: "krop-sind", price_minor: 25_000, online: 0, removed: 0, address: "Yogahuset, Vestergade 10, 8000 Aarhus C" },
      // "Yogahuset" alone is a name: the organizer's house is used - and it is the same place, found once.
      { title: "Lydbad", topic: "krop-sind", price_minor: null, online: 0, removed: 0, address: "Vestergade 10, 8000 Aarhus C" },
      { title: "Mindfulness online", topic: "krop-sind", price_minor: null, online: 1, removed: 0, address: null }]);
  });

  it("follows changes, cancellations and removals, and keeps a hidden event hidden", async () => {
    const db = testDatabase();
    const id = await createSource(db, input(), NOW);
    const { state, fetcher } = calendar(ics(vevent("a", "Yin yoga", "20261015T190000"), vevent("b", "Lydbad", "20261020T190000")));
    await syncSource(db, testDeps(fetcher), (await getSource(db, id))!);
    expect((await syncSource(db, testDeps(fetcher), (await getSource(db, id))!)).written).toBe(0);
    const lydbad = await db.prepare("SELECT id FROM events WHERE source_uid = 'b'").first<{ id: number }>();
    expect(await setEventHidden(db, id, lydbad!.id, true)).toBe(true);
    state.body = ics(vevent("a", "Yin yoga - aflyst", "20261015T190000", "STATUS:CANCELLED"), vevent("b", "Lydbad", "20261020T190000"), vevent("c", "Kakao", "20261101T190000"));
    await syncSource(db, testDeps(fetcher), (await getSource(db, id))!);
    expect((await rows(db)).map(r => [r.title, r.removed])).toEqual([["Yin yoga - aflyst", 1], ["Lydbad", 0], ["Kakao", 0]]);
    expect(await db.prepare("SELECT hidden FROM events WHERE source_uid = 'b'").first()).toEqual({ hidden: 1 });
    state.body = ics(vevent("c", "Kakao", "20261101T190000"));
    await syncSource(db, testDeps(fetcher), (await getSource(db, id))!);
    expect((await rows(db)).filter(r => !r.removed).map(r => r.title)).toEqual(["Kakao"]);
  });

  it("keeps what is shown when a calendar fails, and says why", async () => {
    const db = testDatabase();
    const id = await createSource(db, input(), NOW);
    const { state, fetcher } = calendar(ics(vevent("a", "Yin yoga", "20261015T190000")));
    await syncSource(db, testDeps(fetcher), (await getSource(db, id))!);
    state.status = 500;
    expect((await syncSource(db, testDeps(fetcher), (await getSource(db, id))!)).message).toBe("Kalenderen svarede med fejl 500. De viste events er beholdt.");
    state.status = 200; state.body = "<html>Log ind</html>";
    expect((await syncSource(db, testDeps(fetcher), (await getSource(db, id))!)).message).toContain("hverken en iCal- eller RSS-kalender");
    state.body = "BEGIN:VCALENDAR\r\n" + "X".repeat(3_000_001);
    expect((await syncSource(db, testDeps(fetcher), (await getSource(db, id))!)).message).toContain("for stor");
    expect((await rows(db)).map(r => r.title)).toEqual(["Yin yoga"]);
    expect(await getSource(db, id)).toMatchObject({ last_sync_ok: 0 });
  });

  it("follows the organizer's own filter words", async () => {
    const db = testDatabase();
    const id = await createSource(db, input({ excludeWords: "generalforsamling" }), NOW);
    const { fetcher } = calendar(ics(vevent("a", "Yin yoga", "20261015T190000"), vevent("g", "Generalforsamling", "20261016T190000")));
    expect((await syncSource(db, testDeps(fetcher), (await getSource(db, id))!)).message).toBe("1 kommende event (iCal) · 1 uden for arrangørens filter");
  });

  it("runs once an hour for active calendars only", async () => {
    const db = testDatabase();
    await createSource(db, input(), NOW);
    const paused = await createSource(db, input({ name: "Pause", feedUrl: "https://pause.example/k.ics" }), NOW);
    await setSourceStatus(db, paused, "paused", NOW);
    const { fetcher, calls } = calendar(ics(vevent("a", "Yin yoga", "20261015T190000")));
    await runSourceSync(testEnv(db), testDeps(fetcher, NOW));
    await runSourceSync(testEnv(db), testDeps(fetcher, NOW + 10 * 60_000));
    await runSourceSync(testEnv(db), testDeps(fetcher, NOW + 60 * 60_000));
    expect(calls).toEqual([FEED, FEED]);
  });
});

describe("finding places", () => {
  it("looks each new place up once, a few at a time, and keeps a place set by hand", async () => {
    const db = testDatabase();
    const id = await createSource(db, input(), NOW);
    const nominatim = fakeWeb({
      [FEED]: ics(vevent("a", "Yin yoga", "20261015T190000", "LOCATION:Vestergade 10, 8000 Aarhus C"), vevent("b", "Retreat", "20261016T190000", "LOCATION:Mols Bjerge 1, 8420 Knebel")),
      "https://nominatim.openstreetmap.org/search?": url => new Response(JSON.stringify(url.includes("Vestergade") ? [{ lat: "56.1569", lon: "10.2036" }] : []))
    });
    await syncSource(db, testDeps(nominatim.fetcher), (await getSource(db, id))!);
    const slept: number[] = [];
    expect(await geocodePending(testEnv(db, { GEOCODER_CONTACT: "kontakt@example.org" }), { ...testDeps(nominatim.fetcher), sleep: async ms => { slept.push(ms); } })).toBe(1);
    expect(slept).toEqual([1100]);
    const venues = (await db.prepare("SELECT id, address, lat, lng, status, attempts FROM venues ORDER BY id").all<Record<string, unknown>>()).results!;
    expect(venues.map(v => [v.status, v.lat, v.attempts])).toEqual([["found", 56.1569, 1], ["not_found", null, 1]]);
    expect(nominatim.calls.filter(c => c.includes("nominatim")).every(c => c.includes("countrycodes=dk"))).toBe(true);
    // Set by hand: never overwritten by a later lookup.
    expect(await setVenueByHand(db, Number(venues[1]!.id), 56.25, 10.55, NOW)).toBe(true);
    expect(await setVenueByHand(db, Number(venues[1]!.id), 156.25, 10.55, NOW)).toBe(false);
    await geocodePending(testEnv(db), testDeps(nominatim.fetcher));
    expect(await db.prepare("SELECT lat, status FROM venues WHERE id = ?").bind(venues[1]!.id).first()).toEqual({ lat: 56.25, status: "manual" });
  });
});
