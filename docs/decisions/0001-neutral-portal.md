# 0001: A neutral portal that only reads organizers' own calendars

Status: Accepted (2026-10-02)

## Context

Hjerterum's Partnerplan began with partner events shown inside Hjerterum's own calendar, with a member discount. Phase 1 was built on `stemmebasen/hjerterum`, branch `claude/partnerplan-phase1`, and is parked there, not merged. The chair then refined the idea: one shared website and social media profile for events within spirituality, personal development and mental health in a geographic area, starting with Østjylland. Hjerterum's events and its partners' events are shown equally, in a modern style like the cockpit, with a map and a radius. Outwardly the site is tied to no specific organizer, and it simply pulls data from other sites.

## Decision

- The portal is its own repository, Worker, database and domain. Hjerterum is one source among others.
- It reuses the calendar engine built for the Partnerplan: the iCal/RSS reading, hourly sync, change and cancellation handling, failure handling and conservative price reading.
- Data comes only from organizers' public calendar feeds (iCal or RSS). Organizers' web pages are not scraped. Feeds are stable, they are the organizer's own published data, and they need no per-site code.
- Pages are rendered on the server, and the map (Leaflet, served from the portal) is drawn on top. This makes them fast, indexable and shareable, and the list works without JavaScript.
- Places come from OpenStreetMap Nominatim, are cached per address and can be corrected by hand. The free tiers' usage policies are respected.
- Discounts are not shown yet. That question is open. `sources.benefit` is reserved, so the option stays open without a schema change.

## Consequences

- To add an organizer, you only need their calendar address.
- An organizer without a public calendar cannot be listed yet. Manual entry is a later decision.
- Repeating series are not shown until series expansion is built.
