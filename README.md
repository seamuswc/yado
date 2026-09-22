# Yado — mobile hotel booking for Japan (EN / JA)

Mobile-first hotel booking site built with Next.js 16 (App Router), React 19, Tailwind CSS 4, TypeScript, Drizzle ORM on SQLite, and Stripe.

## Quick start

```bash
npm install
cp .env.example .env.local      # then edit (see "Configuration")
npm run seed                    # creates the head admin, a demo partner, 8 demo hotels with reviews
npm run dev
```

- Public site: http://localhost:3000 (redirects to `/en` or `/ja` from your browser language)
- Admin: http://localhost:3000/admin — sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env.local` (defaults: `admin@example.com` / `change-me-now`). **Change the password after the first login** via "Forgot your password?".
- Demo partner: `partner@example.com` / `partner-demo-1234` at `/ja/partner/login`

Everything works with no external services configured ("demo mode"): payments are simulated, emails are stored in the admin **Emails** page instead of being sent (open sign-in / verification links from there), and translation is skipped.

## What's in it

| Area | Routes | Notes |
| --- | --- | --- |
| Guest site | `/[locale]`, `/search`, `/hotels/[slug]`, `/book`, `/confirmation`, `/bookings`, `/login` | Search by city, station or name; sort by price, rating, room size; Google Maps link; verified-guest reviews |
| Guest login | `/login` → emailed magic link | No passwords. The verified email is the identity; `/bookings` shows every booking under it |
| Partner portal | `/[locale]/partner/register`, `/login`, `/reset`, `/partner`, `/partner/listing`, `/partner/bookings` | Register in Japanese → confirm email → admin review → pay annual fee → live. English copy is auto-translated |
| Admin | `/admin` | Weekly dashboard + server capacity, registrations queue, hotels, bookings (cancel/refund), reviews (hide), users (disable), email outbox, audit log |
| Payments | Stripe Checkout | Guests: one-off payment in JPY. Partners: yearly subscription. Webhook: `/api/stripe/webhook` |
| Assistant API | `/api/v1` | ChatGPT, Grok, or any HTTPS client can search and book (no key). Partners create listings with a Bearer key. OpenAPI: `/api/v1/openapi.json` |

### Flow: hotel registration
1. Partner fills the form in Japanese at `/ja/partner/register` (account + property + rooms; licence number required).
2. Server translates the listing to English (Claude API) and stores it as `translation: machine`; if translation isn't configured the Japanese text is copied and flagged `pending`.
3. Confirmation email → link verifies the address and signs the partner in.
4. Head admin approves or rejects (with a note) in `/admin/registrations`.
5. Partner pays the annual fee (`PARTNER_ANNUAL_FEE_JPY`, default ¥30,000) → listing is live while `paidUntil` is in the future. Renewals extend it via the `invoice.paid` webhook.

### Flow: guest booking
1. Guest picks a room; availability = room `quantity` minus overlapping confirmed/pending bookings.
2. Booking is created as `pending_payment`, guest is sent to Stripe Checkout (30-minute expiry).
3. `checkout.session.completed` webhook (or the confirmation page's fallback check) marks it `confirmed`, emails guest and hotel.
4. Unpaid bookings older than 2 hours are cancelled automatically so the room frees up.
5. After check-out the guest can post one review per booking from `/bookings`.

### Assistants (ChatGPT, Grok)

`GET /api/v1` describes the API. `GET /api/v1/openapi.json` is an OpenAPI 3.0 spec.

- **Guests:** import the spec as a ChatGPT action or a Grok tool. "Book me a room on these dates for this budget near this place" is `GET /api/v1/hotels?near=…&checkIn=…&checkOut=…&maxTotal=…`, then `POST /api/v1/bookings`. No guest key. Payment is Stripe Checkout: the assistant must not ask for the card number. The guest opens `paymentUrl` and enters the card there. The stay stays unpaid until Stripe confirms it. This path does not run in demo mode.
- **Hotels:** create an API key on the partner dashboard and paste it into the chatbot as a Bearer token. "Make a listing with these photos, for this price, at this location" is `POST /api/v1/listings` with that key. Photos are `https` URLs, price is yen per night, location is `city` plus `address`.

Listings stay hidden until admin approval and the annual fee, same as the website. Send an `Idempotency-Key` on writes so a retried assistant call does not book or list twice.

## Configuration (`.env.local`)

| Variable | Purpose |
| --- | --- |
| `DATABASE_PATH` | SQLite file (default `./data/yado.db`). Migrations in `drizzle/` run automatically on startup. |
| `APP_URL` | Public origin used in emails and Stripe redirect URLs |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | Head admin created by `npm run seed` |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Enable real payments. Local testing: `stripe listen --forward-to localhost:3000/api/stripe/webhook` |
| `PARTNER_ANNUAL_FEE_JPY` | Annual partner fee (default 30000) |
| `ANTHROPIC_API_KEY` | Enables JA→EN listing translation (model `claude-opus-5`) |
| `RESEND_API_KEY`, `EMAIL_FROM` | Send real email through Resend; otherwise emails go to the admin outbox |

## Security notes
- Passwords hashed with scrypt; sessions are random tokens stored hashed, httpOnly + SameSite cookies, 30-day expiry.
- Magic-link, verification and reset tokens are single-use, hashed at rest, and expire (1 h / 24 h / 2 h).
- Login, registration and link requests are rate-limited per IP and per email (in-memory; use Redis or a proxy limiter when running several instances).
- Registration has a honeypot field; partner accounts must verify email before signing in; nothing is public until the head admin approves.
- Every server action re-checks the session and the caller's role; partners can only edit their own hotels.
- Stripe webhooks are signature-verified; booking/hotel ids come from Stripe metadata that we set ourselves.
- Admin actions are written to the audit log (`/admin/users`).
- Payment handling is idempotent: a booking is confirmed exactly once (webhook or success-page fallback), and each fee payment source (Checkout session / invoice) extends the paid period only once, so reloads and duplicate webhooks can't add extra years.
- Booking confirmation pages are only shown to the booker (signed-in owner, the browser that made the booking, or the matching Stripe session id).
- Guest magic links are only issued for guest accounts; partner and admin accounts must use their password (with a reset link flow).

## Code map
- `src/db/schema.ts` — tables (users, sessions, tokens, hotels, rooms, bookings, reviews, events, server_samples, emails, audit_log)
- `src/lib/` — `auth.ts` (sessions, tokens, rate limit), `booking-server.ts` (availability, bookings), `hotels.ts` (public queries), `reviews.ts`, `translate.ts`, `stripe.ts`, `email.ts`, `analytics.ts` (weekly stats + capacity heuristics), `i18n.ts` (all UI strings)
- `src/actions/` — server actions: `auth.ts`, `booking.ts`, `partner.ts`, `admin.ts`, `review.ts`
- `src/app/[locale]/` — public + partner pages; `src/app/admin/` — admin; `src/app/api/` — Stripe webhook, auth link handlers
- `src/proxy.ts` — locale redirect, visitor id, path header for analytics
- `src/instrumentation.ts` — minute sampler for server health, expiry of unpaid bookings
- `scripts/seed.ts` — demo data (`npm run seed`, idempotent)

## Going to production
- Move SQLite to Postgres (Drizzle supports it; the schema needs only type tweaks) before running more than one app instance.
- Put the app behind HTTPS; set `APP_URL` accordingly so Stripe redirects and emails use the real domain.
- Configure Stripe live keys and the webhook endpoint; consider Stripe Connect if hotels should be paid out directly.
- Replace picsum placeholder photos and add image upload for partners.
- Add `hreflang` alternates and structured data for SEO.
