# Eventportal (working title)

A curated, neutral overview of events within mental health, personal development and spirituality, starting with Østjylland. It belongs to no organizer. It reads each chosen organizer's own public calendar (iCal or RSS) and shows every organizer's events alike, by time, on a list and a map with a radius. Signup and payment always happen at the organizer.

The website is the backbone of a wider presence: partner venues in the city, posters and brochures in public space, and a social media profile (`docs/BLUEPRINT.md`, sections 2 and 7). The site's tone is professional, modern and elegant, not spiritual.

The name is still to be chosen. It is set in one place: the `SITE_NAME` variable in `wrangler.jsonc`.

- `docs/BLUEPRINT.md` is the product and technical source of truth.
- `docs/decisions/` holds the decision records.

## Layout

- `src/index.ts`: the Cloudflare Worker (`fetch` and the 15-minute cron).
- `src/app.ts`: routes for the public pages, the counted way on to organizers (`/ud/:id`), `robots.txt`, `sitemap.xml` and `/health`.
- `src/sources.ts`, `src/feed.ts`: organizers' calendars. They are read hourly and keep new, changed, cancelled, removed and past events in step.
- `src/geocode.ts`, `src/geo.ts`: places, found once from their address (OpenStreetMap Nominatim) and cached. Also regions, towns and distances.
- `src/events.ts`: what is shown, filtered by when, theme, organizer and radius.
- `src/topics.ts`, `src/price.ts`: themes from plain words, and prices only when they are plainly stated.
- `src/pages/`: server-rendered pages (good for search and sharing). `public/map.js` draws the map with Leaflet, which is served from the portal itself.
- `src/admin/`: the administration (`/admin`), with one password (`ADMIN_PASSWORD`).
- `migrations/`: the D1 schema.

## Develop

```sh
pnpm install
pnpm test            # vitest, on node:sqlite with the real migrations
pnpm typecheck
pnpm exec wrangler d1 migrations apply eventportal-local --local
echo 'ADMIN_PASSWORD=lokal' > .dev.vars
pnpm dev             # http://localhost:8787/ostjylland and /admin
```

## Configuration

| Name | Kind | Purpose |
| --- | --- | --- |
| `ADMIN_PASSWORD` | secret | The administration's one password. Without it, nobody gets in. |
| `SITE_NAME` | var | The portal's name. |
| `CONTACT_EMAIL` | var | Where organizers send their calendar address (shown on `/om`). |
| `GEOCODER_CONTACT` | var | Contact for OpenStreetMap Nominatim's usage policy. |
| `MAP_TILES`, `MAP_ATTRIBUTION` | var | Map tiles. OpenStreetMap's own are used by default. |

Deploying to staging (`.github/workflows/deploy-staging.yml`) needs the repository secrets `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` and `ADMIN_PASSWORD`. Without them the deploy is skipped. The staging D1 database is created on the first deploy.
