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

## 5. 💳 Pro subscriptions — done

Built the actual £14.99/month product.

- [x] Add DJ plan/subscription state to database — `dj_profiles.plan`
      already existed; added `stripe_customer_id`, `stripe_subscription_id`,
      `stripe_subscription_status`
- [x] Create Stripe subscription product/price — real recurring
      £14.99/month GBP price created in Stripe test mode
      (`STRIPE_PRO_PRICE_ID`)
- [x] Upgrade to Pro flow — `/api/stripe/subscribe`: creates a Stripe
      Customer for the DJ (separate from their Connect payout account),
      then a subscription Checkout Session
- [x] Stripe Customer Portal for managing/cancelling subscription —
      `/api/stripe/billing-portal`
- [x] Webhooks to keep Supabase subscription state accurate —
      `customer.subscription.created/updated/deleted` now handled
- [x] Free = 15%
- [x] Pro = 0% — only while `stripe_subscription_status === "active"`;
      any other status (past_due, unpaid, etc.) falls back to the 15%
      Free rate automatically, no separate grace-period logic, recovers
      the moment the subscription goes active again
- [x] Downgrade/cancellation behaviour — subscription end (via Portal or
      webhook) flips `plan` back to `free`
- [x] Pricing UI — DJ Settings' "Coming Soon" card now a real "Upgrade
      to Pro" button
- [x] Settings/billing UI — Free/Pro/payment-issue states all render
      distinctly, with a "Manage Billing" link once subscribed

Checkout route now reads the DJ's real plan + subscription status from
the database rather than a hardcoded default. Verified end-to-end: real
signed webhook events for created(active)/updated(past_due)/deleted all
correctly flipped `plan`/`stripe_subscription_status`, and a real
checkout call priced 0% fee while active and correctly fell back to 15%
fee while past_due. Also drove the actual UI as a real logged-in DJ —
"Upgrade to Pro" genuinely redirects to Stripe's hosted subscription
Checkout, "Manage Billing" genuinely redirects to Stripe's Customer
Portal. All test Stripe customers and DB state were cleaned up
afterward.

## 6. 📊 DJ earnings & finance dashboard

Done — new `/dj/earnings` page, linked from the dashboard header.

- [x] Gross request value
- [x] Platform fees
- [x] DJ net earnings
- [x] Accepted revenue — all four computed from each request's actual
      stored snapshot (`request_amount`, `platform_fee`, `dj_earnings`,
      taken at checkout time), not recalculated from the DJ's current
      prices, so historical figures stay correct even after a price or
      plan change
- [x] Payout information — new `/api/stripe/connect/payouts` route
      pulls the DJ's real Stripe balance (available/pending) and recent
      payouts directly from their connected account
- [x] Transaction/request history — most recent 50 requests with gross
      and net per row
- [x] Clear Free vs Pro fee breakdown — split by `plan_at_checkout`
      (the plan active *when that specific request* was accepted, not
      the DJ's current plan)
- [x] CSV export — client-side, all fields, not just the visible 50

> The DJ should always be able to understand exactly how their earnings
> were calculated.

**Fixed**: `/dj/analytics`'s "Revenue" stat used to recalculate from the
DJ's *current* `request_price`/`shoutout_price` rather than the stored
per-request snapshot, silently misreporting history for any DJ who'd
changed their prices, and ignored the platform fee entirely (it was
really showing gross request value, mislabeled as revenue). Now uses
each request's actual stored `dj_earnings`, relabelled "Net Earnings"
with a pointer to the full breakdown on `/dj/earnings`. Verified live:
correctly now shows £0.00 for the real test account, matching the
`/dj/earnings` finding that nothing has actually been captured yet —
previously this stat would have shown a fabricated ~£250+ from 51
"accepted" requests that were never really paid out.

Verified live: real Stripe payout/balance data loaded correctly for a
connected account; confirmed the £0.00 totals shown for the actual
account were the *correct* answer (every stored financial row belonged
to a `checkout_pending`/`declined` request, never `accepted`+, so
nothing has actually been earned yet) rather than a bug, by cross-
checking the raw DB directly — then proved the summing logic itself
works by inserting one disposable `played` row with known figures and
confirming the totals updated to exactly match before cleaning it up.

## 7. 🔔 Notifications — done

A working DJ shouldn't have to stare at Playing Next.

- [x] New request notification — hooks into the dashboard's existing
      Supabase Realtime subscription (it was already there for live
      dashboard updates, just not used for alerting); a toast fires for
      any newly-appeared *pending* request. Requests already pending
      when the dashboard loads don't trigger anything — only ones that
      show up afterwards.
- [x] New Song + Message notification — same mechanism, distinct copy
      ("New Song + Message request" vs "New song request")
- [x] Browser/mobile notification approach — real OS-level
      `Notification` API, gated on the tab not being focused
      (`document.visibilityState`) so you don't get a redundant popup
      on top of a toast you're already looking at
- [x] Sound/vibration where appropriate — a short two-tone chime
      synthesised with the Web Audio API (no audio asset needed) plus
      `navigator.vibrate` on supporting devices
- [x] Notification preferences — two toggles on DJ Settings (Sound,
      Browser notifications), stored in `localStorage` rather than the
      database since they're a property of the device you're running
      the dashboard on, not the account. Enabling browser notifications
      requests permission on the spot; if it's blocked at the browser
      level, shows a clear error instead of silently doing nothing.

Verified live: opened the dashboard as a real logged-in DJ, inserted a
real pending request directly into the database from outside the app,
and confirmed the realtime subscription picked it up and fired the
toast within about a second — screenshotted mid-toast. Also confirmed
the browser-notification toggle correctly detects a blocked permission
and shows an explanatory error rather than failing silently. Test rows
cleaned up afterward.

**Extended to guests too**, not originally scoped but a natural fit
once DJ notifications existed — a guest closing the confirmation tab
had no way to find out their song got accepted:

- [x] Guest status-change notifications on both `/request/[djSlug]/confirmation`
      and `/request/[djSlug]/my-requests` — both pages already polled
      every 4s (no way to use realtime here, since guests aren't
      authenticated); a toast now fires on any status change, plus a
      real browser Notification if the guest opted in and the tab isn't
      focused. Chose a single on/off toggle rather than the DJ's
      sound/browser split — kept deliberately simpler for a one-off
      guest action, not a recurring workflow. Deliberately **not** SMS —
      see the reasoning below.
- [x] My Requests tracks per-request status independently (a `Map` of
      previous statuses, not just one), so it correctly notifies for
      whichever specific request changed when a guest is tracking
      several at once.

Verified live on both pages: created a real pending request, loaded it
in the browser, updated its status directly in the database from
outside the app (mirroring a DJ accepting it), and confirmed the toast
fired with the correct new status on the next poll — screenshotted on
both pages. Also confirmed the "Notify me" button correctly surfaces
the blocked-permission error.

- [x] Also extended to the main request page (`/request/[djSlug]`)
      itself — a guest who clicks "Request Another Song" and goes back
      to browsing still has an earlier request out for a decision, and
      that page previously had zero visibility into it. Reuses the same
      localStorage-tracked IDs and the same global notification
      preference — nothing new to opt into. Casual first-person copy
      ("Your song was accepted!", "Your song wasn't accepted this
      time.") lives in `requestStatusNotificationCopy()` in
      `requestStatus.ts`, separate from the more formal per-page status
      copy used elsewhere.

Verified live: seeded a real pending request into a fresh browser
tab's localStorage, confirmed via direct fetch-instrumentation (not
just eyeballing the network log, which turned out to have a misleading
display) that the poll runs at a clean, non-duplicated 4000ms cadence,
then updated the request's status externally and confirmed the toast
("Your song wasn't accepted this time.") fired correctly while
"browsing" the request page.

**Considered and deferred**: SMS/text notifications for guests. Would
need collecting phone numbers (a new personal-data category we don't
touch today), a paid SMS provider, and real PECR consent/opt-out
handling for UK text messages — meaningful legal and cost surface for
a need that isn't validated yet. Browser notifications solve the same
"I closed the tab" problem for free, with the known weakness that
they're flakier on iOS Safari specifically. Revisit if that turns out
to be a real recurring complaint once there's actual usage.

## 8. 🧹 Smaller gaps

Found in passing rather than planned from the start; not launch-blocking
but worth closing out alongside 5–7 above.

- [x] Spotify search had no error handling and re-authenticated with
      Spotify on every keystroke — fixed: wrapped in try/catch, caches
      the access token in memory, frontend shows a toast instead of
      silently doing nothing on failure
- [x] Guest self-serve cancel (before the DJ responds) — new
      `/api/request/cancel` route, the guest-side mirror of the DJ's own
      decline path. Only ever touches `pending` requests (card
      authorised, not yet captured), so it can never claw money back
      from a DJ — same trust model as `/api/my-requests` (unauthenticated
      by design, since guests have no accounts; knowledge of the request
      ID is the only "proof" there is, consistent with the rest of the
      guest flow). "Cancel Request"/"Cancel" buttons added to both the
      confirmation page and My Requests. `/legal/guest-terms` and
      `/legal/refund-policy` updated to describe it.
  - [x] **Refund after capture — decided: no refunds, full stop, once
        a DJ accepts.** The alternative was either pulling money back
        out of a DJ's Stripe balance after they'd already been paid
        (`reverse_transfer: true`, risking a dispute with the DJ or a
        negative balance) or Playing Next eating the cost itself —
        rejected outright rather than half-built. `/legal/refund-policy`
        §2 now states this plainly ("it's final and non-refundable"),
        with the standard carve-out for statutory rights that can't be
        excluded by agreement and the guest's own card-issuer dispute
        rights (§5), which no policy wording can override anyway.
        Nothing to build — the answer is simply "we don't do it."
- [ ] Spotify search has no debounce — fires a request on every
      keystroke rather than after a pause. Not broken, just more
      requests than necessary; worth revisiting once the app has real
- [ ] Spotify search has no debounce — fires a request on every
      keystroke rather than after a pause. Not broken, just more
      requests than necessary; worth revisiting once the app has real
      usage volume to see if it actually matters

## 9. 🎬 Motion & page transitions

Explicitly requested, not found in passing: navigation currently just
jump-cuts from page to page. Should feel like a considered, premium
product instead — slide/fade transitions between views rather than a
hard cut, in the same spirit as the earlier icon/primitive/atmosphere
polish pass.

- [ ] Decide the transition mechanism (Next.js View Transitions API vs.
      a library like Framer Motion/motion — trade-off between how much
      control we get and how much complexity/bundle size it adds)
- [ ] Apply consistently across the primary flows: request → song
      selection → checkout → confirmation, and DJ dashboard ↔ settings
- [ ] Respect `prefers-reduced-motion` — motion should be a premium
      touch, not something that fights users who've asked for less of it
