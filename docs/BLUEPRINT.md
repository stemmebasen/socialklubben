# Blueprint

This is the primary product and technical specification of the portal. Update it whenever a product decision changes.

## 1. What it is

The portal is a public website, with a social media profile to follow, that gives one overview of what goes on within spirituality, personal development and mental health in a geographic region. It starts with **Østjylland**. It has a list by day, filters and a map with a radius.

It started from Hjerterum's Partnerplan (`stemmebasen/hjerterum`, `docs/PARTNERPLAN.md`). Rather than showing partners inside Hjerterum's own calendar, the overview is a separate, neutral site. Hjerterum's events and its partners' events are shown alike.

## 2. Vision: present in the city, not only online

Requested by the chair (2026-10-02):

> "Det er vigtigt at få med at portalen skal være eksklusiv og ikke kun leve online, hvor den ellers ville få svært ved at få en eksistensberettigelse. Den skal være levende til stede, have god kontakt med byens steder, som aktivt skal bruge portalen, og vi skal også være synlige i det offentlige rum, f.eks. med plakater og brochurer. Platformen i sig selv skal være simpel, men udbydere skal se platformen som nødvendig for at komme ud til publikummet med events inden for området."

Another event website on its own would have a hard time justifying itself. What makes the portal valuable is what happens around it:

1. **It is exclusive.** The portal is curated, not open listing. Organizers are chosen for relevance and quality (section 3), so the portal stands for something, and being on it means something. Organizers who are on it are treated alike. Exclusivity is about who is in, never about who comes first.
2. **It is present in the city.** The portal works closely with the city's places (studios, centres, cafés, libraries, health houses and other venues). Those places use it actively: they show the programme, hand out the printed material and point their own visitors to it. Each place is a partner, not just an address on a map.
3. **It is visible in public space.** Posters and brochures carry the programme into streets, notice boards and venues, with a QR code back to the portal. A social media profile carries it online.
4. **Organizers need it.** The goal is that an organizer in the region sees the portal as necessary to reach their audience. The audience is already here, in print, at the venues and online, and the organizer reaches it simply by keeping their own calendar.
5. **The platform stays simple.** The website's job is to keep the programme correct and to make the physical presence cheap. Everything printed comes from the same data, so posters and brochures never need typing by hand.

The website is the backbone; the presence around it is the product.

## 3. Non-negotiable principles

1. **Curated.** Organizers are added only by the administration, after an assessment. The criteria:
   - the events are relevant to the portal's themes;
   - the organizer is serious and professional, and active in the region;
   - the events are public and bookable by anyone;
   - the descriptions are of reasonable quality.
   Nobody can pay for a place or for a better position.
2. **Neutral and alike.** The site is tied to no organizer. No organizer's name, logo or colours appear in its frame. Events are ordered by time, never by who arranges them.
3. **The organizer's own calendar is the truth.** The portal only reads it. Organizers keep their own brand, signup, payment, members and data. Every way on goes to the organizer.
4. **No friction for organizers.** Once an organizer is accepted, one public calendar address (iCal/.ics or RSS) is all that is asked. After that, the organizer does nothing.
5. **Professional, modern and elegant, not spiritual.** Requested: "siden må ikke have en spirituel vibe, den skal være professionel, moderne og elegant" (section 5).
6. **Nothing is guessed.** A price is shown only when the event text states it plainly next to a price label and a currency. A theme comes from plain words, with no AI. A place comes from its address, and the administration can correct it.
7. **Privacy.** No cookies or tracking for visitors. "Nær mig" is the browser's position put in the page address. It is never stored, and such pages are never cached in shared caches. Clicks on to organizers are counted per day, without anything about who clicked.
8. **Small steps.** Build only what the next step needs. Expand when there is real use.

## 4. Current scope (v1, 2026-10-02)

- **Regions.** One region, Østjylland (`/ostjylland`), with a centre and an 80 km radius and twelve towns to measure from. More regions are new entries in `src/geo.ts` plus organizers with that region. A place found outside a region's radius is not shown on that region's page.
- **Sources.** An organizer is one calendar address with:
  - a name and a website;
  - a default address, for events that only name the house;
  - a default theme;
  - optional include and exclude words, for calendars that hold more than the portal's themes;
  - a status: active or paused.
  Each active calendar is read once an hour, with at most 300 events per calendar, 180 days ahead and 3 MB per calendar. New, changed, cancelled (`STATUS:CANCELLED`), removed and past events follow by themselves. A failing calendar never removes what is shown, and the error is shown in the administration. Repeating iCal series (`RRULE`) are counted and named, not shown yet. Private or confidential iCal events are never shown.
- **Places.** Each distinct address is one venue. It is looked up once from OpenStreetMap Nominatim (Denmark only, at most 8 per run, about one a second, at most 3 tries) and kept. An event location without a number is a name, not an address ("Hjerterum"), so the organizer's default address is used. Online events have no place. The administration can set coordinates by hand, and a later lookup never overwrites them.
- **Themes**, shown in this order: Mental sundhed, Selvudvikling, Krop & bevægelse, Meditation & mindfulness, Lyd & musik, Fællesskab, Spiritualitet. They have plain names, with the professional framing first. An event's theme comes from the first theme whose words appear in its title, then its text, then the organizer's default. The order themes are matched in is fixed in `src/topics.ts` and is separate from the order they are shown in.
- **Public pages.** There are four views, as tabs at the bottom on a phone and in the menu on a larger screen (decision 0003):
  - **Udforsk** (`/ostjylland`) is the region on a map with a sheet over it. The sheet shows the next 14 days as bars, the chosen day's events as cards, and plain filters: all, with an address, online, free; theme; and "Hvor længe?" (up to 2½ hours, half a day, a whole day, several days). A length is shown only when the calendar gives an end time. Pins are ink with the theme's glyph, and close pins are gathered with a count. When the map moves, the bars, the day's count and the cards only count what is in view, and the area is named after the nearest town.
  - **Planlæg** (`/ostjylland/planlaeg`) is the list by day, with filters for when (i dag, weekend from Friday 16, 7 dage, 30 dage, alle), theme, town or "Nær mig", and radius (5, 10, 25 or 50 km). A series (the same title from the same organizer) is shown once, on its first date, with "+N datoer". Old links with list filters on `/ostjylland` go on here.
  - **Gemt** (`/ostjylland/gemt`) shows the events a visitor has saved. The saved events are kept only in the visitor's own browser and are put in the page address when the page is opened. Nothing about them is stored by the portal.
  - **Søg** (`/ostjylland/sog`) looks through every coming event's title, text, organizer and place. Every word must be found.
  - Each event has a page with schema.org Event data and Open Graph tags, its other coming dates, and a save button. Search and social media read the data and tags.
  - There is an organizers page (alphabetical) and an about page that explains how organizers get listed.
  - There are also `robots.txt`, `sitemap.xml` and `/health`.
  - Every filter lives in the page address, so pages can be shared and work without JavaScript. The map script only follows the map.
- **Administration (`/admin`):**
  - It has one password, a signed 30-day cookie, ten wrong tries per quarter of an hour per address, and forms that are only accepted from its own pages.
  - On the source pages you can add, edit, fetch now, pause and hide a single event.
  - On the places page you can set coordinates or retry the lookup.
  - Counted clicks are shown for the last 30 days.

## 5. Design and tone

The site is **professional, modern and elegant, and has no spiritual vibe.** The portal covers spirituality among other themes, but it is a calm, trustworthy guide, not a spiritual brand.

- **The visual system** is the clean part of Hjerterum's board cockpit: cool paper, white cards, deep ink, one cobalt accent, Bricolage Grotesque, pill buttons and a glass header. There is no glow, no gradients in aura colours (violet, turquoise) and no ornaments. Mandalas, lotus flowers, chakras, moons, stars, soft-focus photos and esoteric typefaces are never used. The brand is a plain wordmark with the region in small capitals. A logo comes with the final name.
- **The language** is editorial and plain. It leads with what people do: "Foredrag, kurser og workshops inden for mental sundhed, selvudvikling og spiritualitet". Theme names are plain ("Spiritualitet", not "Spiritualitet & ceremoni"). The portal's own text makes no promises of healing, energy or transformation. Organizers' event texts are their own and are shown as they wrote them.
- **The layout** has a dark mode. Phones get a single column with the map above the list and filter chips that scroll sideways.
- **Printed material** (posters, brochures) follows the same system: typographic, generous white space, one accent colour, and a QR code.

## 6. Measurements

The portal records:
- active organizers and coming events;
- clicks on to the organizer, per event and organizer, per day;
- places that have no position.
It records nothing about visitors.

Planned with the physical presence: scans of each poster's and brochure's QR code, counted per piece of print and day (for example `?via=plakat-aarhus-uge41`). This shows which places and which print bring visitors. Organizers can get a short monthly summary of the clicks on to them. That is part of what makes the portal necessary for them.

## 7. Presence in the city: roadmap

None of this is built yet. Each step is decided when the one before has real use. The system's part is kept small, and print is generated from the data:

1. **Printable programme.** An A3/A4 poster and a brochure per town and week (or month), generated from the portal's own data. It is typographic and has a QR code back to the matching filtered page. A venue or the portal team prints it and hangs it up. This is the first step proposed.
2. **Partner venues.** These are places that actively use the portal: they hang the poster, hand out brochures, and link to or embed their town's programme on their own site. They are recorded in the administration with a contact, so every place has a person.
3. **QR measurement** per piece of print (section 6).
4. **Social media profile.** It posts the week's programme from the same data.
5. **Monthly summary to organizers**, with their clicks and their place in print.

## 8. Not built yet, by decision

- **Member discounts or other benefits.** Whether to show them is undecided. `sources.benefit` is reserved, so they can be added without a schema change. If they are added, every organizer gets the same option.
- **Repeating series, manual single events, organizer self-service, more regions, AI themes and event images on the list.**

## 9. Open decisions

- The name and domain. Candidates with free .dk domains on 2026-10-02: indrekort.dk, naervaerskort.dk, indrevej.dk, stillesteder.dk, sindskort.dk, sjaelekort.dk, naervaerskalenderen.dk.
- The map tile provider at real traffic. OpenStreetMap's own tiles suit light use. `MAP_TILES` switches to a provider without code changes.
- Discounts (see section 8).
- Which venues become the first partner venues, and who keeps in touch with them.
- Who produces and hangs the printed material, and how often (weekly or monthly).

## 10. Runtime

The portal runs as one Cloudflare Worker with D1 and static assets (Leaflet and `map.js`), and a cron every 15 minutes. Sources are read hourly, and new places are looked up each run. There are separate staging and production environments. A deploy follows only a green CI run (typecheck, tests and a local migration check).
