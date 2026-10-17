# 0003: Four views: Udforsk, Planlæg, Gemt and Søg

Status: Accepted (2026-10-17)

## Context

The chair shared three screenshots of a city events app and asked for the portal to be built further, inspired by its overview and its map ("Du må gerne arbejde videre på den og blive inspireret af dette overblik og med kortvisning"). The app opens on a full map with category pins and a sheet holding a 14-day bar chart, a chosen day, filters and event cards. It has a list grouped by day where a series shows "+N datoer", and tabs for Udforsk, Planlæg, Gemt and Søg.

## Decision

- **The region opens on Udforsk.** It is a full map with a sheet over it, in the same structure as the app. The bar chart counts events per day for the next 14 days. A chosen day shows its events as cards and as pins.
  - The kinds are all, with an address, online and free. These are things the calendars state; the app's "Familier", "Ude" and "Inde" are not, so they are left out (Blueprint 3.6, nothing is guessed). For the same reason, "Hvor længe?" uses only stated end times.
  - Pins are ink with a coloured theme glyph, rather than coloured pins. The seven theme colours are muted, so the map stays calm and professional (Blueprint 5).
- **The list becomes Planlæg.** It has the same filters as before, without the side map, with rows in the app's form: the theme's tile, "TID · TEMA", the title, and the place with its distance. A series is shown once with "+N datoer", and the event page lists the other dates.
- **Gemt keeps the portal free of visitor data.** Saving uses the browser's own storage. The Gemt page receives the saved events in its address, and its responses are never cached in shared caches. There are no cookies and no accounts.
- **Søg is plain.** It matches words in the title, text, organizer and place, with no ranking beyond time.
- **No new dependency.** The map uses Leaflet as before. Gathering close pins is a few lines in `public/explore.js`.

## Consequences

- Everything still works without JavaScript: the bars, chips and day choice are links. With the script, they change the view in place and follow the map.
- Old links to `/ostjylland?nar=…` go on to Planlæg.
- If organizers' calendars later state audience or setting (e.g. families, outdoors), those filters can be added, still only from what the calendars say.
