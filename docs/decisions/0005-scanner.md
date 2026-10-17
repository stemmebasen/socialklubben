# 0005: A scanner that finds, and people who decide

Status: Accepted (2026-10-17)

## Context

The chair asked for "en super smart scanner" that finds small and large events in Østjylland, social media included. The portal is curated and guesses nothing (Blueprint 3), so a scanner must not publish on its own.

## Decision (phase 1)

- **The scanner finds; the administration decides.** Everything it finds goes into a queue (`/admin/fund`). Nothing is shown before someone approves it. A find can be approved as an event of an existing organizer or of a new one, or rejected.
- **Websites.** The administration lists pages to read (`/admin/scanner`), preferably an organizer's event overview. Each is read once a week, a few an hour. The scanner takes:
  - the schema.org event data the page itself states for search engines (title, time, place, price, link, picture, organizer). A field the page does not state stays empty;
  - a calendar address on the page (webcal, .ics, a calendar link). With one click it becomes an organizer whose calendar is read every hour, and the scanner then stops reading the page.
- **Robots.txt is respected.** A page that asks robots not to read it is not read. The scanner names itself in its requests.
- **Duplicates.** A find at about the same time with about the same title as an event already shown is marked, so it can be rejected.
- **Tips.** Anyone can tip an event at `/tip`. A tipper's e-mail is optional, for questions only, and never shown. A hidden field stops robots, and one address can send five tips an hour.
- **Organizers without a calendar.** An organizer can now be "manual": its events are approved finds, one by one.

## Not in phase 1

- Reading pages without event data (AI extraction from text and flyers), a mail-in address, and Instagram and Facebook through Meta's official access. These come in phase 2 and 3. Scraping social media is not done.
- Whether AI may judge relevance and theme. Themes still come from plain words (Blueprint 3.6).

## Consequences

- The queue needs a person. Finds that pass their date without a decision drop out of the queue.
- The list of pages to read is built by hand at first.
