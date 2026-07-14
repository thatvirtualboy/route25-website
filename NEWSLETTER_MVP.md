# Route 25 Collector Spotlights MVP

## Architecture

The newsletter stays inside the existing static Vercel site. `api/newsletter.js` uses the existing Firebase project for Firestore, Auth verification, and Storage, so no new paid service is required. The canonical issue lives at `/newsletter/:slug`; the provider-neutral export returns subject, preview text, HTML, plain text, and canonical URL.

## Local setup

1. Run `npm install`.
2. Set `FIREBASE_SERVICE_ACCOUNT_JSON`, `FIREBASE_STORAGE_BUCKET`, `FIRESTORE_DATABASE_ID=ptdb`, `CRON_SECRET`, and at least one of `NEWSLETTER_ADMIN_UIDS` or `NEWSLETTER_ADMIN_EMAILS` (comma-separated). Set `PUBLIC_SITE_URL=http://localhost:3000` locally. Optionally set `NEWSLETTER_SLACK_WEBHOOK_URL` for new-submission alerts. Sender delivery uses `SENDER_API_TOKEN`, `SENDER_GROUP_ID`, `SENDER_TEST_GROUP_ID`, `SENDER_FROM_NAME`, `SENDER_FROM_EMAIL`, and `SENDER_REPLY_TO`.
3. Run `node scripts/seed-newsletter-questions.js` once per Firebase project.
4. Start with `npx vercel dev`.

Never put the service account in browser code or commit it. The MVP admin screen accepts a Firebase ID token and the API only permits an allowlisted UID/email. Connect the existing Route 25 web-login UI in phase two so the token is supplied automatically.

## Firestore schema contract

- `newsletterQuestions`: question text, category, active flag, timestamp.
- `newsletterSubmissions`: contact/bio, structured collection fields, interview answers, validated images, consent snapshot, editorial status/notes, timestamps.
- `newsletterIssues`: issue number, title/slug/dek/summary/body HTML, email-only editor note, trainer/submission references, ordered images, answers, typed affiliate products, editorial tags, preflight/delivery state, status, subscription URL, publish timestamps.
- `newsletterSubscribers`: SHA-256 email document ID, email, status, source, consent timestamp.

Firestore is schemaless, so the idempotent question seed is the only migration. Existing collections are untouched.

## Security and limits

- Mutations enforce same-origin when `Origin` is present. Admin endpoints verify Firebase tokens and an environment allowlist.
- Strings/arrays are bounded; status and affiliate types are allowlisted.
- Upload URLs expire in 10 minutes. Uploads allow 1–15 JPEG/PNG/WebP/HEIC files, 10 MB each. Server-side metadata is verified and invalid files are deleted.
- Public APIs return only published issues. Affiliate links use `rel="sponsored nofollow"`; every issue includes a disclosure.
- Consent is explicit and timestamped. Add self-service deletion and a retention policy before scaling submissions.
- Scheduled issues publish once weekly on Saturday at 7:00 AM America/Denver. Two UTC cron checks plus a timezone guard preserve the local hour across daylight-saving changes.
- Set `NEWSLETTER_LIVE_SEND_ENABLED=false` while testing. Admin test sends can only use `SENDER_TEST_GROUP_ID`; the weekly job can only use `SENDER_GROUP_ID` when this switch is exactly `true`. Test sends remain available after live sending is enabled because group identity, name, and size are independently verified.
- If live delivery is disabled or Sender fails, the story remains scheduled and private. It is never published without its email. Missed dates do not silently roll into a later Saturday; use Retry/Publish now or reschedule explicitly.

## Editorial workflow

1. Build an issue from an application and save it as a draft.
2. Order the photos (the first selected photo is the hero), add captions/alt text, affiliate products, and editorial tags.
3. Confirm the suggested issue number and optionally add a Route 25 note that appears at the top of the email but is omitted from the public story and public API.
4. Send at least one test email. The target is always the separately configured Sender test group.
5. Choose a future Saturday and save as scheduled. The server requires the complete preflight checklist and prevents duplicate issue numbers and weekly slots.
6. At 7:00 AM Mountain, the job claims only that Saturday's issue, sends the Sender campaign, and then makes the story public. Use Unschedule before delivery, or Publish now/Retry for an intentional recovery.

Run `npm test` to verify daylight-saving slots, missed-date behavior, test-issue isolation, and preflight rules.

## Practical phases

1. **MVP (implemented):** submission/uploads/consent, rotating questions, review queue/status, issue editor, archive and issue pages, affiliate products, subscriber endpoint, email export.
2. **Editorial hardening:** automatic Route 25 web auth, rich-text editor, image reorder/captions and durable public derivatives, previews, scheduling, audit history.
3. **Distribution (Sender adapter implemented):** subscriber synchronization, isolated test-group sends, live-send kill switch, scheduled sends, and campaign IDs/delivery state. Remaining: Sender webhook-based unsubscribe reconciliation and richer analytics.
4. **Scale:** collector/card/gear taxonomy, affiliate matching, moderation/optimization, retention controls, social exports, aggregate gear reporting.

## Email provider hook

With an admin bearer token, call `GET /api/newsletter?action=email-export&slug=the-slug`. The output can be pasted into a provider now or consumed by a later adapter. Keep bulk delivery outside Vercel; synchronize `newsletterSubscribers` with the selected provider.
