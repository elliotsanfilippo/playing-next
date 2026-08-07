# Playing Next — Roadmap to Launch

Working checklist from here to public launch. Check items off as they land;
keep this file up to date rather than tracking progress anywhere else.

Reordered from the original list: security now follows directly after the
financial work (it's the direct continuation of it, and launch-blocking),
mobile QA moved up since this is a QR-code/mobile-first product, and legal
moved up to start in parallel given its long external lead times — even
though it's mostly non-coding and doesn't block engineering work. Pro
subscriptions, the earnings dashboard, and notifications are real features
but none of them block shipping a working, secure, mobile-tested product,
so they moved to the end.

---

## 1. 💰 Finish the financial architecture

- [x] 50p Guest Service Fee decided
- [x] Free plan = 15% platform fee
- [x] Pro = £14.99/month / 0% platform fee
- [x] Financial columns added to `song_requests`
- [x] `src/lib/pricing.ts` created
- [x] Replace/finalise the secure Stripe checkout route
- [x] Verify £5 request → guest authorises £5.50
- [x] Verify £8 request → guest authorises £8.50
- [x] Verify Supabase stores `request_amount`, `platform_fee`, `dj_earnings`, etc.
- [x] Make Stripe Connect actually split the money correctly
- [x] Ensure 50p remains with Playing Next
- [x] Ensure Free plan 15% remains with Playing Next
- [x] Ensure correct DJ amount is transferred
- [x] Capture on acceptance / cancel on decline — verified with real
      Stripe test-mode objects: capture produces an actual Transfer
      (correct amount, correct destination); cancel leaves the charge
      uncaptured with no transfer created
- [ ] Record actual Stripe processing fees
- [ ] Calculate Playing Next's actual net revenue
- [ ] Test refunds, failed payments and cancellations

## 2. 🔐 Security & production readiness — CURRENT

Before strangers and real money are involved. This is one area not to
compromise on.

- [x] Review Supabase RLS on every table — found and fixed a critical
      issue: `song_requests` and `dj_profiles` both had policies granting
      the public anon key unrestricted read access, exposing every
      guest's private message, every request's financial breakdown, and
      DJs' Stripe account IDs to anyone. Fixed by moving all guest-facing
      `song_requests` reads/writes to server routes (`/api/request/create`,
      `/api/my-requests`) and dropping the anon policies entirely;
      `dj_profiles` sensitive columns were locked down via column-level
      `REVOKE`. Verified live: anon key can no longer read or write
      `song_requests`, and the full guest flow (request → confirmation →
      My Requests) plus the DJ dashboard still work correctly.
  - [ ] Re-check when new tables are added (e.g. Pro subscription state)
- [x] Ensure service-role key is server-only — confirmed only used in
      `app/api/*/route.ts` files, no client component references it, no
      client code imports a route module, no accidental `NEXT_PUBLIC_`
      prefix
- [x] Ensure Stripe secret is server-only — same audit, same result
- [x] Stop trusting client-supplied monetary values — checkout route
      already re-derives price from the DJ's profile in the database,
      never trusts the amount the client sends
- [x] Validate all API inputs — reviewed every route; checkout was already
      solid (only trusts a requestId, re-derives everything else server-side).
      Added length caps on guest-submitted text (song title/artist/message,
      DJ slug, Spotify search query) that had none
- [x] Protect DJ-only API endpoints — capture/cancel/connect routes all
      verify the authenticated user owns the request/profile being acted
      on
- [x] Stripe webhook signature verification — also handles abandoned/expired
      checkouts, Stripe's automatic 7-day uncaptured-auth expiry, and
      keeps `stripe_connected` in sync reactively
  - [ ] Still needs a real endpoint registered with Stripe (CLI for local
        dev via `stripe listen`, Dashboard for production) and a real
        `STRIPE_WEBHOOK_SECRET` set — nothing is listening for live
        events yet, only the route code itself is built and tested
- [x] Prevent duplicate checkout/capture
- [x] Rate-limit sensitive endpoints — added to spotify/search (40/min),
      request/create (8/min), stripe/checkout (8/min), my-requests (60/min,
      generous enough for the 4s polling on confirmation + My Requests).
      Verified live: 9th rapid request in a window gets a real 429 with a
      correct Retry-After header, normal usage unaffected.
  - [ ] This is in-memory/per-process, not shared across instances — real
        protection today, but if deployed somewhere that runs multiple
        concurrent instances under load, the effective limit scales with
        instance count. Upstash Redis would close that gap if/when it
        matters.
- [x] Error monitoring — Sentry fully live in local dev: DSN, org, project
      slug and an organisation auth token (for source maps) are all set in
      `.env.local`. Verified for real, not just "should work" — threw a
      real error from a temporary test route and confirmed via Sentry's
      own debug logging that it was captured and successfully flushed to
      Sentry's servers (`Captured error event` → `Done flushing events`).
  - [ ] Still needed: add the same four env vars
        (`NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`,
        `SENTRY_AUTH_TOKEN`) to Vercel once deployed, so production errors
        report too
- [x] Production logging — covered by Vercel's built-in function logs
      (every existing `console.log`/`console.error` already shows up
      there once deployed) plus Sentry's log capture (`enableLogs: true`)
      once the DSN above is set. A dedicated log aggregation service
      (Axiom, Better Stack) would be a nice upgrade later, not needed to
      call this handled for launch.
- [ ] Database backups/recovery plan — pure Supabase dashboard setting,
      nothing to build: check Database → Backups, confirm your plan
      includes Point-in-Time Recovery (paid tiers) and note the retention
      window your tier actually gives you.
- [ ] Environment separation for Stripe test/live — you're on test keys
      now (`sk_test_...`). On Vercel: Project Settings → Environment
      Variables lets you scope different values per environment — put
      Stripe **test** keys on Preview/Development and **live** keys only
      on Production, so a preview deploy can never accidentally take a
      real payment.
- [x] Review `.gitignore` and GitHub for leaked secrets — `.gitignore`
      correctly covers all `.env*` variants; scanned the full git history
      and current tree for Stripe/Supabase/webhook secret patterns, found
      none ever committed

**Also test these scenarios:**

- [ ] Guest abandons Stripe
- [ ] Card declined
- [ ] Duplicate button press
- [ ] DJ pauses during checkout
- [ ] DJ accepts request
- [ ] Playing Next
- [ ] Played
- [ ] Refund
- [ ] Chargeback/dispute
- [ ] Stripe/API outage
- [ ] User closes confirmation page
- [ ] Realtime fails and reconnects

## 3. 📱 Mobile QA & UX

Launch-critical, particularly for guests — this is a QR-code product and
most guests will only ever see it on a phone.

Test properly on:

- iPhone Safari — not tested: no full Xcode install here (needs `sudo
  xcode-select`, requires your password), so no real iOS Simulator access.
  Everything below used Chromium mobile emulation (375px, mobile UA, touch
  points) instead, which catches layout bugs but not genuine WebKit quirks.
- Android Chrome — same caveat as above (emulated, not a real device)
- Desktop Chrome — covered extensively throughout earlier sessions' work
- Safari (desktop) — not tested, same Xcode/WebKit limitation
- Smaller phones — tested at 375px width; worth a manual check at ~320px
  (iPhone SE) too, not done here

And specifically test:

- [x] Homepage — no overflow, correct content/section order, all copy
      present (verified via DOM measurement after the screenshot tool
      proved unreliable mid-session — see note below)
- [ ] DJ search — homepage search section renders correctly, but the
      search interaction itself wasn't exercised on mobile this pass
- [x] Request page — DJ header, badges, genres, layout all clean
- [x] Spotify search — real results returned, correct rendering
- [x] Song selection/change song — selection, truncation on long
      titles/artists, and Change Song all verified working
- [~] Stripe Checkout — our own pre-checkout UI (pricing, button) verified
      on mobile; Stripe's own hosted checkout page wasn't re-checked at
      mobile width in this pass (it's Stripe's responsive design, out of
      our control, but worth a glance)
- [ ] Confirmation — not re-verified at mobile width this pass (uses the
      same primitives already confirmed responsive elsewhere)
- [x] My Requests — empty state renders correctly on mobile
- [ ] DJ dashboard — **not tested, no DJ login credentials available** —
      needs you to check on your own device
- [ ] QR scanning — **cannot test at all, inherently physical** — scan
      your actual printed/displayed QR code with a real phone camera
- [ ] Paused requests — not tested; didn't want to toggle the live DJ's
      request status just for this check
- [x] Long song/artist names — confirmed clean truncation, no overflow
- [ ] Slow internet — not tested, no network throttling available in this
      environment; the skeleton loading states built earlier this session
      should help here regardless

**Tooling note**: the click-simulation part of the browser tool became
unreliable partway through this session (timeouts on tap gestures,
independent of the app). Worked around it with direct form input and
DOM-level interaction to keep testing app logic and rendering, but that
means the literal touch-tap *gesture* wasn't verified as rigorously as
earlier in this session — worth a real-device pass before launch,
especially for anything involving multi-touch or scroll-heavy pages.

## 4. ⚖️ Legal & compliance

Firmly in the before-launch category — start this in parallel now given
the lead times involved, even though it doesn't block engineering work.

- [ ] Decide company/business structure
- [ ] Playing Next trademark/name checks
- [ ] DJ Terms
- [ ] Guest Terms
- [ ] Privacy Policy
- [ ] Cookie Policy/consent
- [ ] Refund & Cancellation Policy
- [ ] Complaints process
- [ ] ICO registration/fee assessment
- [~] UK GDPR data/retention review — factual audit done, see
      `DATA_AUDIT.md` (what's collected, where it goes, retention gaps
      found); actual legal assessment against UK GDPR still needs a
      professional, this is just the input for that
- [~] Processor/vendor review — covered in the same audit: Supabase,
      Stripe, Spotify, Sentry, Vercel, what each receives. Data-residency
      region for Supabase/Vercel not yet confirmed — noted in the doc
- [ ] VAT/accounting advice
- [ ] Payments-regulation/Stripe Connect legal review
- [ ] DJ tax responsibility wording
- [ ] Music licensing responsibility wording
- [ ] Minimum-age policy
- [ ] Company/contact information on website

> Get professional advice on the payments marketplace structure in
> particular before public launch.

## 5. 💳 Pro subscriptions

Build the actual £14.99/month product.

- [ ] Add DJ plan/subscription state to database
- [ ] Create Stripe subscription product/price
- [ ] Upgrade to Pro flow
- [ ] Stripe Customer Portal for managing/cancelling subscription
- [ ] Webhooks to keep Supabase subscription state accurate
- [ ] Free = 15%
- [ ] Pro = 0%
- [ ] Downgrade/cancellation behaviour
- [ ] Pricing UI
- [ ] Settings/billing UI

> Importantly, the checkout route must read the DJ's actual plan from the
> database rather than assuming everyone is Free.

## 6. 📊 DJ earnings & finance dashboard

Once the money calculations are trustworthy:

- [ ] Gross request value
- [ ] Platform fees
- [ ] DJ net earnings
- [ ] Accepted revenue
- [ ] Payout information
- [ ] Transaction/request history
- [ ] Clear Free vs Pro fee breakdown
- [ ] CSV/export eventually

> The DJ should always be able to understand exactly how their earnings
> were calculated.

## 7. 🔔 Notifications

A working DJ shouldn't have to stare at Playing Next.

- [ ] New request notification
- [ ] New Song + Message notification
- [ ] Browser/mobile notification approach
- [ ] Sound/vibration where appropriate
- [ ] Notification preferences
