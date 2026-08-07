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
- [ ] Error monitoring
- [ ] Production logging
- [ ] Database backups/recovery plan
- [ ] Environment separation for Stripe test/live
- [ ] Review `.gitignore` and GitHub for leaked secrets

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

- iPhone Safari
- Android Chrome
- Desktop Chrome
- Safari
- Smaller phones

And specifically test:

- [ ] Homepage
- [ ] DJ search
- [ ] Request page
- [ ] Spotify search
- [ ] Song selection/change song
- [ ] Stripe Checkout
- [ ] Confirmation
- [ ] My Requests
- [ ] DJ dashboard
- [ ] QR scanning
- [ ] Paused requests
- [ ] Long song/artist names
- [ ] Slow internet

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
- [ ] UK GDPR data/retention review
- [ ] Processor/vendor review
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
