# Route 25 Collector Stories MVP

## Architecture

The newsletter stays inside the existing static Vercel site. `api/newsletter.js` uses the existing Firebase project for Firestore, Auth verification, and Storage, so no new paid service is required. The canonical issue lives at `/newsletter/:slug`; the provider-neutral export returns subject, preview text, HTML, plain text, and canonical URL.

## Local setup

1. Run `npm install`.
2. Set `FIREBASE_SERVICE_ACCOUNT_JSON`, `FIREBASE_STORAGE_BUCKET`, `FIRESTORE_DATABASE_ID=ptdb`, `CRON_SECRET`, and at least one of `NEWSLETTER_ADMIN_UIDS` or `NEWSLETTER_ADMIN_EMAILS` (comma-separated). Set `PUBLIC_SITE_URL=http://localhost:3000` locally. Optionally set `NEWSLETTER_SLACK_WEBHOOK_URL` for new-submission alerts.
3. Run `node scripts/seed-newsletter-questions.js` once per Firebase project.
4. Start with `npx vercel dev`.

Never put the service account in browser code or commit it. The MVP admin screen accepts a Firebase ID token and the API only permits an allowlisted UID/email. Connect the existing Route 25 web-login UI in phase two so the token is supplied automatically.

## Firestore schema contract

- `newsletterQuestions`: question text, category, active flag, timestamp.
- `newsletterSubmissions`: contact/bio, structured collection fields, interview answers, validated images, consent snapshot, editorial status/notes, timestamps.
- `newsletterIssues`: title/slug/dek/summary/body HTML, trainer/submission references, images, answers, typed affiliate products, status, subscription URL, publish timestamps.
- `newsletterSubscribers`: SHA-256 email document ID, email, status, source, consent timestamp.

Firestore is schemaless, so the idempotent question seed is the only migration. Existing collections are untouched.

## Security and limits

- Mutations enforce same-origin when `Origin` is present. Admin endpoints verify Firebase tokens and an environment allowlist.
- Strings/arrays are bounded; status and affiliate types are allowlisted.
- Upload URLs expire in 10 minutes. Uploads allow 1–15 JPEG/PNG/WebP/HEIC files, 10 MB each. Server-side metadata is verified and invalid files are deleted.
- Public APIs return only published issues. Affiliate links use `rel="sponsored nofollow"`; every issue includes a disclosure.
- Consent is explicit and timestamped. Add self-service deletion and a retention policy before scaling submissions.
- Scheduled issues are checked once daily by the low-cost Vercel cron. A due issue may publish later than its selected time; use manual publishing when an exact minute matters.

## Practical phases

1. **MVP (implemented):** submission/uploads/consent, rotating questions, review queue/status, issue editor, archive and issue pages, affiliate products, subscriber endpoint, email export.
2. **Editorial hardening:** automatic Route 25 web auth, rich-text editor, image reorder/captions and durable public derivatives, previews, scheduling, audit history.
3. **Distribution:** one low-cost provider adapter, double opt-in/unsubscribe sync, scheduled sends, analytics, reusable Gear Spotlight.
4. **Scale:** collector/card/gear taxonomy, affiliate matching, moderation/optimization, retention controls, social exports, aggregate gear reporting.

## Email provider hook

With an admin bearer token, call `GET /api/newsletter?action=email-export&slug=the-slug`. The output can be pasted into a provider now or consumed by a later adapter. Keep bulk delivery outside Vercel; synchronize `newsletterSubscribers` with the selected provider.
