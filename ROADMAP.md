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
- [x] Test refunds, failed payments and cancellations — see the full
      scenario list in §2 below; found and fixed a real gap: refunds and
      disputes weren't handled by the webhook at all

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
      checkouts, Stripe's automatic 7-day uncaptured-auth expiry, keeps
      `stripe_connected` in sync reactively, and now also handles
      post-capture refunds and disputes (`charge.refunded`,
      `charge.dispute.created`) — this was a real gap found while working
      through the scenario list below: a refund or chargeback happening
      outside the app (Stripe Dashboard, cardholder's bank) previously
      left the request frozen showing "Playing Next"/"Played" to the
      guest even though the money had moved back. Verified with signed
      test events against a real disposable DB row: full refund →
      `refunded`, partial refund → correctly left untouched, dispute →
      `disputed` even from `played`. New statuses render correctly on
      the confirmation page and are included in the DJ's "clear history"
      action alongside `played`/`declined`.
  - [x] Endpoint is registered with Stripe and live in production
  - [ ] The live endpoint's subscribed events still need
        `charge.refunded` and `charge.dispute.created` added in the
        Stripe Dashboard (Developers → Webhooks) — the code handles them
        now, but Stripe won't send them until the endpoint is subscribed
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

- [x] Guest abandons Stripe — handled by the existing
      `checkout.session.expired` webhook handler (24h Stripe session
      expiry → `declined`, guest never charged)
- [x] Card declined — Stripe Checkout handles this natively on its own
      hosted page; our side never sees it (no session/PaymentIntent
      state changes), so the guest just retries or abandons, which folds
      into the scenario above
- [x] Duplicate button press — already covered in this section: checkout/
      capture/cancel all guard on the request's current status before
      acting
- [x] DJ pauses during checkout — confirmed via code review:
      `/api/request/create` blocks *new* requests once paused, but the
      checkout route (which runs for a request already created) doesn't
      re-check the DJ's paused flag. That's the correct behaviour, not a
      gap — the request was already accepted into the flow before the
      DJ paused, so it still completes and lands as `pending` for the DJ
      to action manually
- [x] DJ accepts request — already verified earlier in this section with
      a real Stripe test-mode Transfer
- [x] Playing Next / Played — standard dashboard status transitions;
      confirmation page already had copy for both and reflects them via
      polling
- [x] Refund — tested with a signed webhook event against a disposable
      DB row; found and fixed the missing handler (see above)
- [x] Chargeback/dispute — same fix, same test method
- [~] Stripe/API outage — not load-tested against a real outage; reviewed
      the code instead, every Stripe call in the checkout/capture/cancel/
      webhook routes is already wrapped in try/catch with a real error
      response rather than an unhandled crash
- [x] User closes confirmation page — the page has no client-only state;
      it re-fetches purely from the `requestId` in the URL on every load,
      so a reload/reopen always shows the current real status
- [x] Realtime fails and reconnects — this scenario is stale: realtime
      was removed earlier this session in favour of 4s polling (see the
      RLS fix above). Polling doesn't need to "reconnect" the way a
      WebSocket does — a single failed fetch just gets retried on the
      next 4s tick automatically

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

Every registration and payment this section generates is consolidated in
[PRE_LAUNCH_CHECKLIST.md](PRE_LAUNCH_CHECKLIST.md) — check that closer to
launch rather than hunting through this file for costs.

- [ ] Decide company/business structure — deliberately deferred until
      closer to launch
- [x] Playing Next trademark/name checks — searched the UK IPO trademark
      register directly (Similar/All words, and Contains String for the
      exact phrase): zero results either way. No one currently holds a UK
      trademark on "Playing Next". Not a full legal clearance (doesn't
      check unregistered/passing-off rights or EU/international marks) —
      worth a proper solicitor-run clearance before committing long-term
      to the name.
- [x] DJ Terms — drafted, `/legal/dj-terms`
- [x] Guest Terms — drafted, `/legal/guest-terms`
- [x] Privacy Policy — drafted, `/legal/privacy`, using the facts already
      gathered in `DATA_AUDIT.md`
- [ ] Cookie Policy/consent — not needed as a standalone page: confirmed
      in `DATA_AUDIT.md` that we don't set cookies ourselves; Privacy
      Policy already covers Stripe's checkout cookies
- [x] Refund & Cancellation Policy — drafted, `/legal/refund-policy`,
      honestly documents that refunds after capture are handled manually
      (no in-app refund flow exists yet)
- [x] Complaints process — Guest Terms and DJ Terms §10/§12 now cover how
      to complain and a 5-business-day acknowledgement commitment, and
      draw the line between complaints about us vs. things only Stripe
      can resolve (payout/verification issues on your connected account)
- [ ] ICO registration/fee assessment — researched, not yet done: we
      almost certainly need to register and pay the fee, since we process
      personal data electronically and don't fall under any exemption
      (not a charity, not paper-only). Given the size of the business,
      **Tier 1 (micro, ≤£632k turnover or ≤10 staff) applies — £52/year,
      £47 by direct debit.** This is a real action only you can take
      (needs your own ICO account/payment): run the ICO's free
      self-assessment tool, then register, at
      [ico.org.uk/for-organisations/data-protection-fee](https://ico.org.uk/for-organisations/data-protection-fee/).
      Can be done as a sole trader now — doesn't need to wait on the
      company structure decision.
- [~] UK GDPR data/retention review — factual audit done, see
      `DATA_AUDIT.md` (what's collected, where it goes, retention gaps
      found); actual legal assessment against UK GDPR still needs a
      professional, this is just the input for that
- [~] Processor/vendor review — covered in the same audit: Supabase,
      Stripe, Spotify, Sentry, Vercel, what each receives. Data-residency
      region for Supabase/Vercel not yet confirmed — noted in the doc
- [ ] VAT/accounting advice
- [ ] Payments-regulation/Stripe Connect legal review
- [x] DJ tax responsibility wording — covered in DJ Terms §6: DJs are
      independent, not employees, responsible for their own tax
- [x] Music licensing responsibility wording — covered in Guest Terms §5
      and DJ Terms §6: DJ/venue's responsibility, not ours
- [x] Minimum-age policy — set in the Privacy Policy: 16+ to submit a
      paid request or create a DJ account, 18+ specifically for DJ
      accounts (Stripe Connect requires a legal adult) — a reasonable
      default, not a legally reviewed one
- [~] Company/contact information on website — footer now has a
      site-wide support contact line and links to all four legal pages
      (Stripe requires this to be publicly visible, not just linked from
      checkout). The support email itself is still a `[TBD]` placeholder
      — needs a real address before launch

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
