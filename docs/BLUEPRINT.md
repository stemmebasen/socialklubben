# Blueprint

This is the primary product and technical specification of the portal. Update it whenever a product decision changes.

## 1. What it is

The portal is a public website, with a social media profile to follow, that gives one overview of what goes on within spirituality, personal development and mental health in a geographic region. It starts with **Østjylland**. It has a list by day, filters and a map with a radius.

It started from Hjerterum's Partnerplan (`stemmebasen/hjerterum`, `docs/PARTNERPLAN.md`). Rather than showing partners inside Hjerterum's own calendar, the overview is a separate, neutral site. Hjerterum's events and its partners' events are shown alike.

## 2. Non-negotiable principles

1. **Neutral.** The site is tied to no organizer. No organizer's name, logo or colours appear in its frame. Events are ordered by time, never by who arranges them. Nobody pays to come first.
2. **The organizer's own calendar is the truth.** The portal only reads it. Organizers keep their own brand, signup, payment, members and data. Every way on goes to the organizer.
3. **No friction for organizers.** One public calendar address (iCal/.ics or RSS) is all that is asked. After that, the organizer does nothing.
4. **Nothing is guessed.** A price is shown only when the event text states it plainly next to a price label and a currency. A theme comes from plain words, with no AI. A place comes from its address, and the administration can correct it.
5. **Privacy.** No cookies or tracking for visitors. "Nær mig" is the browser's position put in the page address. It is never stored, and such pages are never cached in shared caches. Clicks on to organizers are counted per day, without anything about who clicked.
6. **Small steps.** Build only what the next step needs. Expand when there is real use.

## 3. Current scope (v1, 2026-10-02)

- **Regions.** One region, Østjylland (`/ostjylland`), with a centre and an 80 km radius and twelve towns to measure from. More regions are new entries in `src/geo.ts` plus organizers with that region. A place found outside a region's radius is not shown on that region's page.
- **Sources.** An organizer is one calendar address with:
  - a name and a website;
  - a default address, for events that only name the house;
  - a default theme;
  - optional include and exclude words, for calendars that hold more than the portal's themes;
  - a status: active or paused.
  Each active calendar is read once an hour, with at most 300 events per calendar, 180 days ahead and 3 MB per calendar. New, changed, cancelled (`STATUS:CANCELLED`), removed and past events follow by themselves. A failing calendar never removes what is shown, and the error is shown in the administration. Repeating iCal series (`RRULE`) are counted and named, not shown yet. Private or confidential iCal events are never shown.
- **Places.** Each distinct address is one venue. It is looked up once from OpenStreetMap Nominatim (Denmark only, at most 8 per run, about one a second, at most 3 tries) and kept. An event location without a number is a name, not an address ("Hjerterum"), so the organizer's default address is used. Online events have no place. The administration can set coordinates by hand, and a later lookup never overwrites them.
- **Themes:** Mental sundhed, Meditation & mindfulness, Lyd & musik, Krop & bevægelse, Spiritualitet & ceremoni, Cirkler & fællesskab, Selvudvikling & kurser. An event's theme comes from the first theme whose words appear in its title, then its text, then the organizer's default.
- **Public pages:**
  - The region page has filters for when (i dag, weekend from Friday 16, 7 dage, 30 dage, alle), theme, town or "Nær mig", and radius (5, 10, 25 or 50 km). It shows a list by day and a map with one point per place and the radius as a circle.
  - Each event has a page with schema.org Event data and Open Graph tags. Search and social media read both.
  - There is an organizers page (alphabetical) and an about page that explains how organizers get listed.
  - There are also `robots.txt`, `sitemap.xml` and `/health`.
  - Every filter lives in the page address, so pages can be shared and work without JavaScript. The map is drawn on top of the list.
- **Administration (`/admin`):**
  - It has one password, a signed 30-day cookie, ten wrong tries per quarter of an hour per address, and forms that are only accepted from its own pages.
  - On the source pages you can add, edit, fetch now, pause and hide a single event.
  - On the places page you can set coordinates or retry the lookup.
  - Counted clicks are shown for the last 30 days.

## 4. Design

The portal uses the same design language as Hjerterum's board cockpit: cool paper, white cards, deep ink, one cobalt accent, Bricolage Grotesque, pill buttons, a glass header and a soft glow. It has a dark mode. The mark is three concentric rings, the radius on the map. Phones get a single column with the map above the list and filter chips that scroll sideways.

## 5. Measurements

The portal records:
- active organizers and coming events;
- clicks on to the organizer, per event and organizer, per day;
- places that have no position.
It records nothing about visitors.

## 6. Not built yet, by decision

- **Member discounts or other benefits.** Whether to show them is undecided. `sources.benefit` is reserved, so they can be added without a schema change. If they are added, every organizer gets the same option.
- **The social media profile**, for example automatic posts of the week's events. A later step, built on this data.
- **Repeating series, manual single events, organizer self-service, more regions, AI themes and event images on the list.**

## 7. Open decisions

- The name and domain. Candidates with free .dk domains on 2026-10-02: indrekort.dk, naervaerskort.dk, indrevej.dk, stillesteder.dk, sindskort.dk, sjaelekort.dk, naervaerskalenderen.dk.
- The map tile provider at real traffic. OpenStreetMap's own tiles suit light use. `MAP_TILES` switches to a provider without code changes.
- Discounts (see section 6).

## 8. Runtime

The portal runs as one Cloudflare Worker with D1 and static assets (Leaflet and `map.js`), and a cron every 15 minutes. Sources are read hourly, and new places are looked up each run. There are separate staging and production environments. A deploy follows only a green CI run (typecheck, tests and a local migration check).
