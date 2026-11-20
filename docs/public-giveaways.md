# Public giveaways

- `/giveaways` displays current/upcoming prizes and paginated past events.
- `/giveaways/<event-id>/rules` is the permanent rules URL. The shorter event URL redirects here.
- Every page is server-rendered from the backend's anonymous `GET /api/giveaways/public` endpoint. Published admin records are the sole source for the app and website. No separate rules entry, account, or website database credentials are needed.
- Original rules are rendered as escaped plain text with line breaks preserved. Event details and rules remain available after closing, cancellation, selection, an unclaimed prize, redraw or shipping. No winner identities, addresses, entry data or drawing secrets are fetched by these pages.
- Active events refresh at their opening/closing boundary using backend time. All responses use `no-store`. Unavailable services return 503, unknown/unpublished events return 404, and malformed archive links return 400.
- The overview is linked from the homepage navigation/footer and static sitemap; each history page links to permanent rules and older events. Rules pages are canonical and printable. No production giveaway is published by deploying this website.

## Local review

Start the backend's isolated giveaway runner, then run `PORT=3107 ROUTE25_BACKEND_ORIGIN=http://127.0.0.1:8887 npm run dev:local` here. Open http://127.0.0.1:3107/giveaways. The backend staging admin's public-rules links use this local port. Prize images use staging's loopback image server; only the local server extends its image CSP to that loopback origin. Production uses the standard production backend and unchanged CSP. Catalog artwork and Firebase admin-uploaded photos are supported; custom images on other hosts remain subject to the existing site image allowlist. Unavailable artwork falls back to the prize name. Never configure production with a staging origin.

Run `npm test` and `npm run verify:production`. Tests cover exact rules text, XSS, current/history separation, all lifecycle phases, empty and failure states, HTTP method and HEAD handling, clock transitions, canonical URLs and local/production route parity. Live staging verification creates only a disposable synthetic event and tests draft → upcoming → open → closed → cancelled without advancing the shared clock.
