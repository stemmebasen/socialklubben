# 0004: A web app first, the app stores later

Status: Accepted (2026-10-17)

## Context

The chair asked how the portal becomes an app.

## Decision

- **The portal is installable as a web app now.** It has a manifest, icons and a service worker. On Android, Chrome offers "Installer app". On an iPhone, Safari's "Føj til hjemmeskærm" adds it. It opens full screen in Udforsk, with the tab bar it already has.
- **Offline is modest.** Pages are always fetched fresh, and the last pages seen are kept for when there is no connection. Nothing private is kept: a page with a position or saved events is marked no-store, and the administration and the way on to organizers are not touched.
- **The app stores come later.** Apple turns down apps that only wrap a website. A store version is worth it once the portal has something only an app does well (for example notifications about saved events or new events near you). It can then be wrapped (e.g. with Capacitor) from the same code. Both stores charge for a developer account.

## Consequences

- No separate code to keep up: the website is the app.
- The manifest names the portal "Eventportal" until the final name is chosen; the name, icon and colours change with it.
