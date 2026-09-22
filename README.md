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

In development, everything works with no external services configured ("demo mode"): payments are simulated, emails are stored in the admin **Emails** page instead of being sent (open sign-in / verification links from there), and translation is skipped. A production server does not simulate payments.

## What's in it

| Area | Routes | Notes |
| --- | --- | --- |
| Guest site | `/[locale]`, `/search`, `/hotels/[slug]`, `/book`, `/confirmation`, `/bookings`, `/login` | Search by city, station or name; nightly price range; sort by price, rating, or room size; Google Maps link; verified-guest reviews |
| Guest login | `/login` → emailed magic link | No passwords. The verified email is the identity; `/bookings` shows every booking under it |
| Partner portal | `/[locale]/partner/register`, `/login`, `/reset`, `/partner`, `/partner/listing`, `/partner/bookings`, `/partner/api` | Register the property, confirm email, wait for admin approval, add rooms on the listing page or with your own assistant, pay the annual fee. API keys live on their own tab |
| Admin | `/admin` | Weekly dashboard + server capacity, registrations queue, hotels, bookings (cancel/refund), reviews (hide), users (disable), email outbox, audit log |
| Payments | Stripe Checkout | Guests: one-off payment in JPY. Partners: yearly subscription. Webhook: `/api/stripe/webhook` |
| Assistant API | `/api/v1` | Any AI or HTTPS client can search and book (no key). Partners create listings with a Bearer key. OpenAPI: `/api/v1/openapi.json`, plain-text guide: `/llms.txt` |

### Flow: hotel registration
1. Partner registers with a name, email, and password, plus the property only: hotel name, type, city, street address, and a Google Maps link. No rooms are created.
2. Confirmation email → the link verifies the address and signs the partner in. The listing stays hidden.
3. Head admin approves or rejects (with a note) in `/admin/registrations`.
4. The owner adds rooms, the description, and the rest of the listing on the listing page, or from their own assistant (any AI) with a Yado API key. English is translated from Japanese when an edit leaves English blank.
5. Partner pays the annual fee (`PARTNER_ANNUAL_FEE_JPY`, default ¥30,000). The listing is public while `paidUntil` is in the future and it has at least one room. Renewals extend it via the `invoice.paid` webhook.

### Flow: guest booking
1. Guest picks a room; availability = room `quantity` minus overlapping confirmed/pending bookings.
2. Booking is created as `pending_payment`, guest is sent to Stripe Checkout (30-minute expiry).
3. `checkout.session.completed` webhook (or the confirmation page's fallback check) marks it `confirmed`, emails guest and hotel.
4. Unpaid bookings older than 2 hours are cancelled automatically so the room frees up.
5. After check-out the guest can post one review per booking from `/bookings`.

### Assistants (any AI)

`GET /api/v1` describes the API. `GET /api/v1/openapi.json` is an OpenAPI 3.0 spec. `GET /llms.txt` is the short plain-text version. A person tells their assistant the site address and talks normally; the assistant does the calls.

- **Guests:** "Book me a room in Kyoto next weekend for two, under ¥20,000 a night" is `GET /api/v1/hotels?near=…&checkIn=…&checkOut=…&guests=…&maxPricePerNight=…&sort=priceLow`, then `POST /api/v1/bookings` with the guest's name, email, and phone. No guest key. The assistant must not ask for the card number. With Stripe configured the reply carries `paymentUrl` and the stay is unpaid until Stripe confirms it. Without Stripe (development only) the reply carries `confirmationUrl` and the stay is confirmed at once; production refuses.
- **Hotels:** create an API key on the partner **API** tab (`/[locale]/partner/api`), tap Copy key, and paste it into the assistant as a Bearer token. "List Sakura Inn in Gion, Kyoto, ¥18,000 a night, here is the map link and a photo" is `POST /api/v1/listings` with `name`, `city`, `address`, `pricePerNight`, `photos`, and `mapsUrl`. English is fine; phone, licence, Japanese text, rooms, amenities, and check-in times are optional and coerced from plain values ("3pm", "Wi-Fi", "18,000"). One room is created from `pricePerNight` when no `rooms` array is sent. The same key updates the listing with `PUT /api/v1/listings/{id}`.

On production a new listing stays hidden until admin approval and the annual fee, same as the website. On a development server without Stripe it goes live at once so the guest flow can be tested end to end; the API response says which happened. Send an `Idempotency-Key` on writes so a retried assistant call does not book or list twice.

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
| `CONTACT_EMAIL` | Address in the public footer. Defaults to `hello@yado.example` |

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
- Set `NODE_ENV=production`. Without Stripe keys, production will not confirm a guest stay or mark the annual fee paid. Development still simulates both when the keys are blank.
- Set `CONTACT_EMAIL` to a real inbox. The footer falls back to `hello@yado.example`.
- Set `TRUST_PROXY=1` only when a reverse proxy you control sets `X-Forwarded-For`. Otherwise every client shares one rate-limit bucket.
- Configure Stripe live keys and the webhook endpoint. Guest refunds are issued by the head admin from `/admin/bookings` (Cancel, or Cancel + refund). The guest pays Yado; there is no guest refund form and no hotel approval step. Consider Stripe Connect if hotels should be paid out directly.
- Replace picsum placeholder photos and add image upload for partners.
- Add `hreflang` alternates and structured data for SEO.
