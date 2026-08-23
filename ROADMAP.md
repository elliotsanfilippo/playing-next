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
- [x] Pro = £49.99/month / 0% platform fee
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
- [x] Record actual Stripe processing fees — new `song_requests.stripe_fee`
      column, set in `/api/stripe/capture` by expanding
      `latest_charge.balance_transaction` on the same capture call (no
      extra round trip). Written via the service role, same pattern as
      every other financial field on this table. Best-effort: if the fee
      isn't available for some reason, that doesn't block the DJ's
      request from being accepted. Verified with a real test-mode
      capture end-to-end: captured a genuine £5.50 authorisation,
      confirmed `stripe_fee` recorded `37` (pence), then independently
      re-fetched the same charge straight from Stripe's API and got the
      identical `37` — not just plausible-looking, actually cross-checked.
- [x] Calculate Playing Next's actual net revenue — the formula, now that
      every input is captured per request:
      `sum(platform_fee) + sum(guest_service_fee) - sum(stripe_fee)`
      across `accepted`/`playing_next`/`played` requests. No dedicated
      admin page built for this — it's a business-owner-only metric with
      no existing admin surface in the app, and there's no real revenue
      yet to display (the live account still shows £0 captured; see
      `/dj/earnings`'s verification note). Can be computed on demand any
      time from real data now that the inputs exist; say the word if an
      actual admin view becomes worth building later.
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
  - [x] Live endpoint's subscribed events verified directly against the
        Stripe API (not assumed from memory): `checkout.session.expired`,
        `payment_intent.canceled`, `account.updated`, `charge.refunded`,
        `charge.dispute.created`, `customer.subscription.created/updated/deleted`
        — all present, added incrementally as each feature needed them
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
- [x] DJ search — actually exercised this time (typed into the homepage
      "Search DJs..." box at mobile width): real results render with
      photo/name/genre/status, tapped result resolved to the correct
      `/request/[slug]` href. The dropdown looked transparent in one
      screenshot — checked `getComputedStyle` rather than trusting the
      image, confirmed a fully opaque `zinc-950` background; that was a
      screenshot-tool artifact (same class of issue flagged earlier this
      session), not a real bug
- [x] Request page — DJ header, badges, genres, layout all clean
- [x] Spotify search — real results returned, correct rendering
- [x] Song selection/change song — selection, truncation on long
      titles/artists, and Change Song all verified working
- [~] Stripe Checkout — our own pre-checkout UI (pricing, button) verified
      on mobile; Stripe's own hosted checkout page wasn't re-checked at
      mobile width in this pass (it's Stripe's responsive design, out of
      our control, but worth a glance)
- [x] Confirmation — re-verified with the fuller content variant (Song +
      Message, accepted status, queue position all rendering together —
      the most layout-dense combination this page can show), zero
      horizontal overflow confirmed via DOM measurement at 375px
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

Built the actual paid product. Now £49.99/month — the source of truth
is `PRO_MONTHLY_PRICE_GBP` in `src/lib/pricing.ts`, which both `/plans`
and the homepage pricing teaser read from, so this file should never be
the place anyone checks the price. It was £14.99 when this section was
originally written, which is why the Stripe notes below mention that
figure.

- [x] Add DJ plan/subscription state to database — `dj_profiles.plan`
      already existed; added `stripe_customer_id`, `stripe_subscription_id`,
      `stripe_subscription_status`
- [x] Create Stripe subscription product/price — real recurring GBP
      price created in Stripe test mode (`STRIPE_PRO_PRICE_ID`), at
      £14.99 at the time; the live price is now £49.99
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
- [x] Spotify search debounce — 300ms debounce plus `AbortController` to
      cancel any still-in-flight search when a newer one starts, so a
      slow response for an earlier keystroke can never overwrite fresher
      results. Verified live via direct `fetch` instrumentation (not
      just the network log, which displayed misleadingly during earlier
      testing this session): typing "levels" as 6 separate keystrokes
      produced exactly 1 API call, for the final complete word — not any
      intermediate partial string — and real results still rendered
      correctly.

## 9. 🎬 Motion & smooth in-page scrolling — done

What shipped is narrower than what this section originally scoped, and
that's a direct result of clarifying the actual ask partway through
rather than continuing to build the wrong thing:

- [x] **What was actually wanted**: clicking a header/footer/hero link
      to a section already on the same page (Find a DJ, Features, How
      it Works) should glide there, not jump-cut. Solved with one CSS
      rule — `scroll-behavior: smooth` on `html` in `globals.css`, with
      `prefers-reduced-motion: reduce` falling back to instant `auto`
      scrolling. Applies globally by nature of being a single global
      rule, though right now only the homepage actually has any
      same-page anchor links (`#find-dj`, `#features`, `#how-it-works`)
      for it to act on — checked the whole app to confirm. Verified
      live after the pivot.
- [x] Respect `prefers-reduced-motion` — same `@media` block, covers
      the actual shipped feature now.

**What was built first, then reverted, and why** (kept for the record
since real time went into root-causing it, not because any of it
shipped):

- React's native `<ViewTransition>` (what the bundled Next.js 16 docs
  describe) needs a React canary build. Checked directly against what's
  actually installed (`react@19.2.4`, stable) rather than trusting the
  docs' "you don't need to install canary yourself" claim — confirmed
  `ViewTransition` genuinely isn't exported. Rejected upgrading to
  canary React for a decorative feature.
- Framer Motion's `AnimatePresence` wrapping `{children}` in the root
  layout looked correct (clean build, styles visibly applied) but a
  `MutationObserver` proved it was a silent no-op: old and new page
  swapped in the same tick, zero style-interpolation ever ran.
  `AnimatePresence`'s exit-hold doesn't reliably survive how the App
  Router swaps `{children}` — a real, documented friction point.
- Pivoted to `next-view-transitions` (a small wrapper around the real
  `document.startViewTransition`, not React's canary component — works
  on stable React), then to a hand-rolled replacement when that also
  failed. Every navigation threw `InvalidStateError: Transition was
  aborted`. Root-caused with the most minimal possible test — a bare
  `document.startViewTransition()` changing one `<div>`'s text, zero
  React/Next involved — which **also** failed identically, proving the
  problem was the automated test browser itself, not any of the actual
  implementations. Had the user confirm directly in their own browser
  console (`ready: OK`, `finished: OK`) — the real API works fine there.
- Even once technically working, the user testing it directly said
  plainly they didn't want it: the actual ask, restated, was in-page
  anchor scrolling, not page-to-page transitions at all. Reverted
  cleanly — `next-view-transitions` and `motion` both uninstalled, all
  17 files' `Link`/`useRouter` imports back to plain `next/link` /
  `next/navigation`, hand-rolled module deleted, custom
  `::view-transition-*` CSS removed. Confirmed zero leftover references
  anywhere before moving on.

The honest lesson: should have confirmed the specific in-page-vs-
page-to-page reading of "slide/fade transitions between views" before
building three different technical approaches to it.

---

## 10. ✉️ Playing Next email design system — future phase

Audited 2026-08-20 during the mobile/homepage pass. **Nothing here has
been implemented or rewritten yet** — this is the scope, plus what the
audit actually found.

### What exists today

Emails reach a Playing Next user from three different places, and we
only control the markup of one of them.

**1. Sent by our own code (Resend), 2 templates:**

| Trigger | Recipient | Where | Current state |
| --- | --- | --- | --- |
| Free QR display block claimed | DJ | `app/api/stripe/qr-box-success/route.ts` | Bare `<p>` tags built inline in the route. No layout, no logo, no footer, no unsubscribe. |
| Same order, ops copy | `QR_BOX_OPS_EMAIL` | same file | Same. Internal, so lower priority. |

`src/lib/email.ts` is the only sender: a single `fetch` to Resend's
`/emails` endpoint taking `{ to, subject, html }`. It has no concept of
a layout, so every caller hand-writes raw HTML. That is the natural
place for a `renderEmail(...)` layout function to live.

**2. Sent by Supabase Auth (templates live in the Supabase dashboard,
not in this repo):**

| Trigger | Called from |
| --- | --- |
| Signup confirmation | `supabase.auth.signUp()` — `app/signup/page.tsx` |
| Confirmation resend | `supabase.auth.resend()` — `app/login/page.tsx` |
| Password reset | `supabase.auth.resetPasswordForEmail()` — `app/forgot-password/page.tsx` |

These are currently Supabase's stock templates. We control their content
and styling, but only through the Supabase dashboard, so they need to be
kept in sync with whatever design system we build here — worth keeping a
copy of the HTML in the repo for that reason.

Magic link, email change and invite templates also exist in Supabase but
no flow in the app triggers them yet.

**3. Sent by Stripe (Stripe dashboard):** guest payment receipts,
Connect onboarding and payout notifications, Pro subscription invoices.
Branding for these is the Stripe business profile, which is a separate
setting per environment — see the note about Live vs Sandbox profiles
not syncing.

### The real finding

Almost every email a DJ or guest would expect **does not exist at all**.
There is no email for: request accepted, request declined, payout sent,
welcome/onboarding, nightly or weekly earnings summary, dispute opened
or resolved, Pro upgrade confirmed, or subscription payment failed.
Those journeys are currently push-notification and in-app only. So this
phase is mostly *building* the email experience, not restyling it.

### Scope for the phase

- [ ] A shared email layout in `src/lib/email.ts` (or a new
      `src/lib/email/` module): table-based, inlined styles, 600px
      body, tested for the usual clients.
- [ ] Design system inside that layout: branding and logo, type scale,
      spacing scale, button component, status treatments matching
      `requestStatus.ts`, a request/song presentation block, monetary
      value formatting consistent with `MoneyValue`, footer and legal
      treatment.
- [ ] Mobile email rendering and dark/light client resilience —
      including the fact that many clients invert or recolour dark
      backgrounds, so the dark-first product palette cannot simply be
      reused.
- [ ] Restyle the 2 existing QR box emails onto the layout.
- [ ] Port the 3 Supabase Auth templates onto the same design, and keep
      a copy of the HTML in the repo.
- [ ] Build the missing transactional emails listed under "The real
      finding" above, with the DJ-facing and guest-facing sets styled
      consistently but distinguishable.
- [ ] A professional Playing Next email signature for direct/manual
      email from `info@playingnextapp.com`.
- [ ] Decide sending domain and authentication (SPF/DKIM/DMARC) before
      volume goes up, and add an unsubscribe/preferences story for
      anything that isn't strictly transactional.

Goal: someone opens a Playing Next email and thinks "even their emails
feel premium."

---

## 11. 🔔 Guest push notifications — future phase

Today's guest "Notify Me" is honest about what it is, but it is not push.
It calls `new Notification()` from inside the status-polling loop, so it
only fires while the page is still alive in a background tab. Close the
tab or let the phone sleep the page and nothing arrives — which is
precisely when a guest most wants to hear that their song is up next. The
copy says "while this page is open" for that reason.

Real guest push needs its own design and security work. Do not extend the
DJ system to cover it: `src/lib/push.ts` authenticates with `authedFetch`
and assumes an account, and guests deliberately have neither.

- [ ] Decide how a push subscription is bound to locally-owned request
      IDs without inventing guest accounts. The ownership model is a list
      of request IDs in `localStorage`; a subscription has to prove it is
      allowed to hear about those IDs and no others.
- [ ] Work out what happens when the same device holds requests for
      several DJs, and when `localStorage` is cleared while a
      subscription is still live on the server.
- [ ] Choose which transitions are worth interrupting someone for.
      Accepted, Playing Next and Declined are the obvious three; Played
      is arguably noise once the song has already been heard.
- [ ] Notification fatigue: one guest with several requests on a busy
      night should not get a stream of separate alerts.
- [ ] Revoke and unsubscribe, including from the guest's side with no
      account to log into.
- [ ] Privacy review — a subscription endpoint is a durable identifier
      for a person we otherwise deliberately do not identify.
- [ ] iOS support reality check: Safari requires the site to be added to
      the Home Screen before web push works at all, which is a hard sell
      mid-gig and may make this Android-first in practice.

---

## 12. 💳 Stripe pre-launch payment QA

The sandbox happy path is proven end to end: checkout → authorisation →
Waiting for DJ → accept → capture → In Queue → Playing Next → Played,
with the money verified at every transition. What is *not* proven is the
webhook half, because webhooks cannot reach `localhost` and there was no
Stripe CLI available when the lifecycle work was done.

None of this needs the payment architecture changed. It needs
`stripe listen --forward-to localhost:3000/api/stripe/webhook` and a pass
through the events.

- [ ] `checkout.session.completed` — the server-side fallback when the
      guest's browser never returns from Stripe. The redirect path that
      races it is proven; this one is only proven by reading.
- [ ] `checkout.session.expired` — the mechanism that closes abandoned
      checkouts. Confirmed working on Stripe's side (a session really
      does go `expired`); the resulting row transition is untested.
- [ ] `charge.refunded` → `refunded` and `charge.dispute.created` →
      `disputed`.
- [ ] Late-event idempotency: fire a `checkout.session.completed` at a
      row the stale sweep has already closed and confirm the status
      guards make it a no-op rather than resurrecting it.
- [ ] Decide the Preview webhook strategy. The sandbox endpoint currently
      points at the *production* URL, which is not a sensible arrangement
      for branch deployments.
- [ ] Verify the **live** Pro price matches `PRO_MONTHLY_PRICE_GBP`
      (£49.99). The test-mode price is £14.99, and `pricing.ts` warns in
      a comment that the constant and the Stripe Price must be changed
      together or the UI and the real charge disagree.
- [ ] Confirm every Stripe-related variable in Vercel Preview is
      test-mode, not just `STRIPE_SECRET_KEY` — `STRIPE_WEBHOOK_SECRET`
      and `STRIPE_PRO_PRICE_ID` too.

---

## 13. 🔌 Connect follow-ups after Phase 5D

Logged during 5D and deliberately not fixed there. None of them block the
beta; all three were found while correcting the `stripe_connected`
semantics.

- [ ] Authenticated Payments QA. The health model and the auth gates are
      tested, but nobody has signed in and walked the real flow: start
      onboarding, return from Stripe, hit the refresh return path, open
      Manage in Stripe from a `payouts_paused` account, and confirm the
      `onboarding_incomplete` fallback routes to hosted onboarding. Needs
      a real DJ session, so it cannot be done from a test harness.
- [ ] `/api/stripe/connect/payouts` silently writes to Stripe on every
      Earnings load: it retrieves the account and, if the payout schedule
      is not `manual`, calls `accounts.update` to force it. That was a
      migration for DJs onboarded before manual payouts became the
      default, and it has been running on every page load ever since. It
      should be a one-off backfill or move to account creation, not a
      write hidden inside a read path.
- [ ] Optional: cache richer payout health so Settings can say "Ready" or
      "Action required" rather than only "Receiving earnings". Needs a
      column (payouts enabled, requirements due) written by the same
      places that write `stripe_connected`. Without it Settings cannot
      distinguish a healthy account from one with a payout hold, which is
      why it deliberately does not claim "Ready" today.

- [x] `stripe_connected` backfill — not needed. The live dry run, run
      from a temporary admin route inside Vercel Production because the
      live key is a Sensitive variable that cannot be read out, checked
      all 10 live Connect accounts and found **zero** rows disagreeing
      with the new semantics. That also answers the open question from
      the 5D audit: the four DJs reading `false` are genuinely
      `setup_incomplete` — their transfers capability is not active —
      rather than DJs with a paused payout who were wrongly blocked. No
      rows were written and no apply was run. The temporary route has
      been deleted; the shared module and CLI script remain as drift
      auditing tooling.

---

## 14. 🎉 Events Mode: what 5E left for later

5E made the event model correct rather than large. What it deliberately
did not do, and what would have to be true first.

- [ ] **Gig-day semantics.** An event is the right boundary for "which
      night is this" — it survives midnight, where a browser-local
      calendar day does not, and both `song_requests.event_id` and
      `tips.event_id` are already stamped at creation. Migrating
      Dashboard Tonight, Earnings Today and the Analytics ranges onto it
      would need two things that are not true yet: real adoption (the
      table has zero rows, so every figure would fall back to today's
      behaviour and the new path would ship untested), and a durable
      event start timestamp. `created_at` is now a fair proxy because
      "Run again" creates a new row per gig rather than reactivating an
      old one, but it is still the row's creation, not the moment the
      music started. Decide that before migrating anything financial.
- [ ] Three concepts of "a night" still coexist: `session_started_at`
      (drives the post-gig recap), the browser-local calendar day
      (Tonight, Earnings Today, Analytics) and the active event
      (pricing). None is wrong alone; there is simply no single answer
      to "which gig is this". Events is the candidate to become that
      answer.
- [ ] Roadmap-only, explicitly out of scope for 5E: scheduled event
      times, venue and location, event types, do-not-play lists,
      explicit filtering, genre rules, wedding schedules, event QR
      branding, event capacity overrides, and a standalone `/dj/events`
      page.
- [ ] An event left active for a long time is surfaced as a prompt on
      the dashboard after 24 hours rather than expiring on a timer,
      because a price changing underneath a DJ mid-set is worse than the
      problem it solves. If a lapsed Pro subscription is renewed months
      later, the old event becomes effective again and the prompt is
      what catches it. A firmer rule can replace this if it ever bites.
