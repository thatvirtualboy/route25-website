# Public giveaways

`/giveaways` is an evergreen static page explaining free entry, explicit opt-in, optional verified friend referrals, winner selection and prize claims. It contains bundled card/product artwork for illustration. It does not fetch, list or track current, upcoming or past promotions and continues working when the backend is unavailable. The homepage navigation/footer and sitemap link here.

`/giveaways/<event-id>/rules` is a separate permanent rules URL; the shorter event URL redirects here. These pages read the same published admin record as the app through the backend's anonymous public endpoint. No separate rules entry or website database credentials are needed. They preserve the exact original rules after closing, cancellation, selection, an unclaimed prize, redraw or shipping. These links are available from the giveaway admin and referral invitation pages, without a public event directory.

Rules are rendered as escaped plain text with line breaks preserved, are canonical and printable, and expose no winner identities, addresses, entry data or drawing secrets. Event rules pages use no-store and refresh at entry-window boundaries using backend time. Unknown/unpublished events return 404; upstream failures return 503. Publishing approval gates remain unchanged.

## Local review

Start the backend's isolated giveaway runner, then run `PORT=3107 ROUTE25_BACKEND_ORIGIN=http://127.0.0.1:8887 npm run dev:local` here. The overview needs no backend. The backend staging admin's public-rules links use this local port. Only the local server extends its image CSP to that loopback origin. Production keeps the existing image policy: catalog artwork and Firebase admin-uploaded photos are supported; other hosts remain subject to the existing allowlist. Unavailable event artwork falls back to the prize name.

Run `npm test` and `npm run verify:production`. Tests cover the static overview during a backend outage, bundled assets, exact event rules, XSS, all lifecycle phases, 404/503 states, HTTP methods and HEAD, deadline refresh, canonical URLs and route parity. A real isolated staging flow verifies draft → upcoming → open → closed → cancelled without advancing the shared clock or touching production.

Static illustration sources (existing backend catalog assets): Ancient Mew (`public/card-images/basep/ancient-mew.jpg`), Mega Kangaskhan ex (`public/card-images/mep/mep-025.png`) and Stellar Crown Elite Trainer Box (`public/etbs/sv7-etb.png`). Optimized WebP copies are bundled under `assets/giveaways/`.

The Home-header reference (`assets/giveaways/home-gift-icon.webp`) is an exact crop of the isolated iOS staging app, captured on November 20, 2026 after restoring the gift button's native Liquid Glass style to match Search. Source: Device Hub screenshot of the iPhone 18 Pro simulator running the `Giveaway Preview` build (`com.raktech.Route25GiveawayPreview`). Crop: x=0, y=180, width=1206, height=240. It includes only the app controls, with no device frame, status bar, feed content or test-account details. `GiveawayHomeButton` appears for upcoming and open events and expires when entries close.
