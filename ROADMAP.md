# Playing Next — Roadmap

The authoritative source of truth for what is built, what is next, and
what has been decided. Operational DJ acquisition lives in
[GROWTH_CRM.md](GROWTH_CRM.md); the registrations and costs that need
Elliot's own name and card live in
[PRE_LAUNCH_CHECKLIST.md](PRE_LAUNCH_CHECKLIST.md). Data and vendor
detail for a lawyer or accountant lives in [DATA_AUDIT.md](DATA_AUDIT.md).

Nothing completed keeps an open checkbox. Anything parked records why and
who decided. Ideas never sit next to approved work.

---

## 1. Current status

Playing Next is a live, revenue-taking product on **live Stripe**, running
a small DJ beta as a sole trader.

- **Production**: `playingnextapp.com` (apex), `www` redirects, Vercel
  functions pinned to `lhr1` beside the London Supabase instance.
- **Beta**: a 23-person outreach pipeline has produced 8 signups and, as
  at 2026-09-01, **17 DJ profiles — 14 external**, 5 of which are
  onboarded and payments-ready. **Zero external DJs have activated.** An activated DJ is one who has accepted a first
  paid request; account creation, onboarding and Stripe connection are
  explicitly not activation. The only two accounts that have ever received
  a request are Elliot's own. **The live pipeline is the Admin CRM at
  `/admin`**; [GROWTH_CRM.md](GROWTH_CRM.md) is the history and the growth
  strategy behind it.
- **The current constraint is activation, not acquisition.** Contact to
  signup works. Signup to first use is **0 of 14** external accounts
  (17 profiles less the three internal ones).
- **Current phase**: none. Phase 6A (Dashboard and live gig operations),
  6B (Admin redesign and CRM), 6C (CRM operating model) and 6D (data
  retention and erasure) are complete as far as they can go and verified
  against Production. 6D's destructive half is deliberately blocked; see
  §5.
- **Deployed commit**: `44dffc7`, 2026-09-03. Onboarding-recovery emails
  are built and R1 has been sent once to nine DJs; the delivery webhook
  is live; no scheduler exists and R2 has never been sent. See §12a.

The product is feature-complete for the beta. The open work is legal and
compliance, QA that needs a real DJ login, growth instrumentation, and
deliberate future scope. Nothing in the codebase is half-built.

---

## 2. Product principles and locked decisions

These are settled. Changing one is a deliberate decision, not a detail.

- **Free must remain genuinely usable and able to earn.** A Free DJ can
  charge for requests from their first guest. This is the difference
  against PlayThatNext, whose free tier cannot accept money at all.
- **Core earning functionality is never moved behind Pro to make Pro look
  better.** Pro earns its price by adding, not by removing.
- **Current Free/Pro split**: Pro is 0% platform fee on requests,
  Analytics, Events Mode, and scheduled auto-close. Free is 15% and
  everything else.
- **Financial snapshots are immutable.** `plan_at_checkout`,
  `platform_fee_rate_bps`, `dj_earnings` and `pricing_version` are written
  once at checkout and never recomputed. Historical money is history.
- **Server truth beats stale UI.** Every money or state transition is
  guarded server-side with an expected prior status. A stale device is
  told what actually happened; it never overwrites newer truth.
- **One Playing Next request per DJ**, enforced by a partial unique index
  and a transactional RPC, not by UI convention.
- **Guest pricing must equal what checkout honours.** The price a guest is
  quoted and the price they are charged are resolved from the same place.
- **The public data boundary lives in Postgres, not in application code.**
  `anon` holds column grants and reads a deliberately shaped view. A new
  column is private until someone edits a migration.
- **A failure is never rendered as an absence.** "We could not load this"
  and "this does not exist" are different states everywhere they can occur.
- **Destructive actions never carry primary visual emphasis**, and
  irreversible ones ask first.
- **Tips pay out 100% to the DJ** regardless of plan. Only the flat guest
  service fee applies.
- **Copy style**: no em or en dashes in user-facing copy. Marketing copy is
  centred; product UI is left-aligned.
- **Activation means a first paid request.** An activated DJ is an external
  DJ who has accepted their first paid request. Account creation,
  onboarding completion and Stripe connection are readiness, not use, and
  are explicitly not activation. Adopted 2026-08-28; it is what makes the
  current honest number zero rather than four.

---

## 3. Recently completed — 6A Dashboard, 6B Admin and CRM, 6C CRM operating model

### Phase 6D — Data retention and erasure. Built; destructive half BLOCKED, 2026-09-01.

Playing Next had no retention policy and no deletion mechanism of any
kind. It now has both, built and verified, with everything destructive
deliberately disabled. Full detail in §5; the state that must survive a
context reset is here.

**Applied to Production**, in this order, each verified after applying:
`20260831_drop_customer_name.sql` (dead column, 0 of 176 populated, 0
code references), `20260831_data_erasures.sql`, then
`20260831_data_erasures_revoke.sql`, then
`20260831_erase_atomically.sql`.

**The revoke exists because a GRANT does not withhold.** The first
migration granted service_role SELECT and INSERT and claimed in its own
comment that nothing held UPDATE or DELETE. Verified against Production
immediately after applying: both returned 200, not 42501, because
Supabase's default privileges had already granted everything. Same class
of error as 2026-08-28 in the opposite direction. **Privileges have to be
revoked to be absent.** `data_erasures` is now genuinely append-only,
re-verified.

**Built and live, all non-destructive:** a payment classification that
fails closed (`src/lib/retention.ts`, zero I/O), R1-R4 as a report-only
panel, and a manual privacy-request workflow with Stripe and attribute
lookup, ownership verification and server-authoritative classification.

**The safety gates, all still closed:**

| Gate | State |
| --- | --- |
| `ERASURE_EXECUTION_ENABLED` | **unset** — erase route returns 503 |
| `RETENTION_EXECUTION_ENABLED` | **unset** |
| Automatic executor for R1-R4 | **does not exist**; 0 callers of the guard |
| `/api/admin/retention` | GET only; 0 mutating verbs |
| `src/lib/retention.ts` | 0 writes; no I/O at all |
| Manual erasure | never deletes a row; `row_deleted` is a literal false |
| `data_erasures` in Production | 0 rows |

**Verification split, recorded honestly.** Pure logic passes **46/46**
(`scripts/erasure-rules.test.mts`, no database). The database write path
passes **15/15** (`scripts/erasure-writepath.test.mts`) against an
isolated second Supabase Free project, never against Production.

**Test environment.** `test-environment/erasure/` holds a fixture schema
that is **not a migration** and must never be promoted into
`supabase/migrations/`. Its source tables are inferred from the
PostgREST description, which exposes no CHECK constraints, RLS, grants,
triggers or indexes, so it proves the transaction and **nothing about
Production**. Production security was verified separately, against
Production, read-only. Synthetic fixtures only; Production personal data
must never be loaded there.

**Standing rule from this phase:** Production verification is read-only.
No INSERT probes into `data_erasures`, no destructive tests against
Production. Probe a permission by aiming a verb at a condition matching
no rows — 42501 means the grant is absent, 200 with zero rows means it is
present — which works for UPDATE and DELETE and is why INSERT testing
must happen elsewhere.

### Phase 6C — CRM operating model. COMPLETE, 2026-08-30.

6B built the CRM. 6C is what a fortnight of using it on a phone exposed:
a modal that could not be touched, a field inventing data it had never
been given, and a directory that made you reconstruct the shape of the
pipeline by eye every time. Nine commits, `7a60147` to `cd85d23`, all
verified on Production against the real 32 rows.

**The P0.** Tapping **+ Task** opened a sheet whose every control was
dead, on desktop and on the installed iPhone app alike. Proven with
`elementsFromPoint` before anything was changed: all nine controls
reported `main` as the topmost element, and **all four children of
`<main>` carried `inert`**. Not a `pointer-events` bug (`auto`
everywhere), not an event-blocking bug (the modal system has one capture
listener, `keydown`, and no pointer handlers at all), and nothing was
layered above the sheet — z-index was correct. `inert` removes a subtree
from hit testing entirely.

The cause: the sheet and the drawer are siblings in `<main>`, and both
pass an inline arrow as `onClose`, so `useModalA11y`'s effect re-ran on
every render of the Admin page. Opening the sheet **is** a render, so the
drawer re-walked its siblings at the moment the sheet existed and marked
it inert. `onClose` now lives in a ref, and a mount-order dialog stack
means only the topmost dialog marks anything.

Verification surfaced two more bugs in the same file. Topmost was "the
last `[role="dialog"]` in document order", but the sheet renders *before*
the drawer, so **Escape was closing the contact drawer out from under the
open sheet**. And React applies `autoFocus` during commit, before the
hook's effect, so the hook recorded the sheet's own title field as its
return target and on close focused a node it had just unmounted, dropping
focus to `<body>`.

**Next gig was never wrong in the data.** Zero of 23 contacts have ever
had a `next_gig_date`; nothing infers or defaults it. An empty
`<input type="date">` renders as a filled-looking field and opens a wheel
sitting on today, so the control was lying about data that did not exist.
It now reads "No date set" with Set date, and Clear once set.

**Contacts is a grouped directory.** Eight groups, seven of which *are* a
lifecycle stage read off `row.stage` — nothing re-derives what the
resolver decided. The eighth, New signups, is the only judgement, and
exists because an account with no CRM contact has two true answers at
once. Precedence: an account with no `crm_contact` that is not internal
goes to New signups; everything else goes to its stage. Verified: 32
rows, every row in exactly one group, counts summing to the total.
Internal accounts are excluded from New signups deliberately — they would
sit for ever in a queue whose purpose is to be emptied, and excluding them
is also what keeps Repeat and Pro from reading as empty when they are not.

All groups start collapsed and it is a single-open accordion, so Contacts
opens on the directory — every heading and count on one screen — rather
than inside a group. Group state is local to the component, so leaving
for Tasks and returning resets it. Search still searches everyone
regardless of what is collapsed, and returns a flat list carrying each
person's group. People inside a group are A–Z; Overview and Tasks stay
urgency-driven.

**New signups is an inbox, workable from either end.** Add as new
contact, or Link to existing prospect, both on the account record. The
picker searches only contacts with `dj_profile_id` null and is a search
box, not a suggester: no ranking, no scoring, no email comparison, no
name-similarity matching. Selection is explicit and the confirmation
names both sides. Both directions call one `performLink`, which attaches
`dj_profile_id` and writes nothing else — which is what makes it a link
rather than a merge. Verified end to end: New signups 6 → 5, Onboarding
4 → 5, no reload, notes, tasks and blocker all carried across.

**`outreach_status` stopped being a copy of product truth.** Nothing read
it, and all seven linked contacts held `signed_up` while nobody else did,
so it said nothing about anyone with an account. The select now offers
five genuinely manual states; `signed_up` and `lost` are retired from the
UI and linking no longer writes either. **No data was migrated and no
value was dropped from the CHECK constraint** — a stored legacy value
still renders so that opening a contact and saving cannot silently
rewrite it, exactly as `next_action` was retired.

**One name per person.** `rowIdentity` and `rowLabel` disagreed about the
fallback, so the same DJ read as `/smithgraeme91` in Contacts and as
"Sol / Graeme Smith" on their own task. `rowIdentity` is now the single
authority — real DJ name unless it is the `New DJ` default, then the CRM
`display_name`, then the slug — and `rowLabel` returns its answer rather
than deciding again.

The design document is an artifact rather than a file in the repo.

### Phase 6B — Admin redesign and CRM. COMPLETE, 2026-08-29.

The Admin was a table of DJs with no notion of where any of them were.
It is now three destinations built around what needs doing.

- `crm_contacts` and `crm_notes`, RLS on with no policies and explicit
  per-role revokes. Verified in production: `anon` and `authenticated`
  both receive 42501 on all eight verb/table combinations, including a
  real logged-in DJ session, and every `/api/admin/*` route returns 403
  without the allowlist.
- Lifecycle stage derived by `src/lib/djLifecycle.ts` and stored nowhere.
- Overview, Contacts (List and a read-only lifecycle Pipeline), Reports.
- The external funnel presents only genuinely nested sets: 13 signed up,
  4 finished onboarding, 0 activated, 0 repeat, with the two DJs who
  connected payments without finishing onboarding reported separately
  rather than hidden inside a line they do not belong on.
- Needs You ranks by tiers, and blockers carry an actionability policy so
  recording outreach cannot make a person disappear.
- Prospect to DJ linking is explicit and never fuzzy; the UNIQUE
  constraint surfaces as a readable conflict. 6C added the same
  operation from the account side.
- The 23-person pipeline was migrated: 23 contacts, 7 linked, Tarz
  deliberately unlinked, 4 relationship notes preserved.

Open items are relationship decisions rather than engineering: Tarz's
link, and the identity of `/roxanemetzjyha`. 6C gave both a place to be
worked rather than remembered — they sit in the New signups inbox and in
the Prospects group until reconciled.

### Phase 6A — Dashboard and live gig operations

The question: can a DJ run an entire busy gig from the Dashboard without
babysitting the app, losing track of requests, or making accidental
financial decisions?

**Tier 1 — money and state integrity. DONE.**
- Accept is one server-authoritative operation (`7218a80`)
- Capture reconciles against the PaymentIntent's real state, so a captured
  payment can never strand a pending row
- Exactly-once capture, verified live
- Requests with no PaymentIntent are refused rather than bypassing the server

**Tier 2 — live reliability. DONE and verified.** (`caf02c8`, `512d717`)
- Transition guards on every Dashboard mutation
- Playing Next invariant, DB index plus transactional RPC
- Explicit Dashboard load failure, stale state and offline handling
- Accept disabled when server truth is unknown
- All five two-device and live-gig tests passed on Production; Stripe
  confirmed the correct capture count with no duplicates

**Tier 3a — booth safety and legibility. DONE and verified.**
(`ce18937`, `8818ccc`) Measured on the live authenticated dashboard at a
true 390x1340 viewport, before and after.

- **Modal keyboard safety.** With the QR formats dialog open, focus never
  left `<body>`, Escape did nothing, and 19 of 24 focusable elements were
  still outside it and tabbable. One of them was Pause: a DJ working by
  keyboard could tab out of a print dialog onto the control that takes
  them off the air mid-set. Both modals now have dialog semantics, focus
  moved in on open, a Tab/Shift+Tab wrap, Escape, focus restored to the
  trigger, and inert on everything outside. **Verified: Pause is inside an
  inert subtree and cannot take focus while a dialog is open.**
- **Contrast: 12 WCAG AA failures to 0**, 41 elements checked. New
  `--color-text-muted` (#8b8b93) measures 5.37-5.93:1 on all three
  surfaces. Chosen over zinc-400, which passes but reads as body text and
  would flatten the hierarchy; only the 12 measured failures were changed
  rather than all 45 zinc-500/600 usages.
- **Accept/Decline spacing 10px to 16px.** Order and emphasis unchanged,
  both still 48px, Accept still the wider primary.
- **Zero-pending state 255px to 149px**, moving the Queue from 645px to
  539px on a phone.
- **Queue live region added.** Derived from the queue's shape, so a burst
  of reorders settles into one announcement rather than narrating renders.
- **Clear History** now announces as "Clear played history".
- **Withdrawn as a false positive:** "Mark Played lacks focus-visible"
  came from counting occurrences per file. The shared `Button` already
  carries the full focus ring, so nothing needed fixing.

**Tier 3b — pending-card compaction. Decided: not now (Option D).**
Measured at 390px: a standard card costs 140px, one with a guest message
226px, putting the Queue at 602px with 1 pending, 1248px with 5 and
1749px with 8. The zero-pending fix does not help the busy case because
the cost is the cards themselves.

Every material reduction needs a change that was explicitly reserved:
buttons inline with the text (a card redesign), collapsing guest messages
(hides what the guest paid extra for, and what the DJ needs to decide), or
an internal scroll region (nested scrolling on a phone). **Elliot chose to
keep the current layout.** The Tonight links already jump straight to
Needs You and the Queue, so a long list stays navigable.

**Not started: the 8-component accessibility sweep** (EventsCard,
HistoryCard, QRCard, AutoCloseControl, ChargebackBanner,
NotificationsStrip, SetupChecklist, QrBoxBanner).

**Outstanding from the 6A audit, not yet scheduled:**
- `archived`, `refunded` and `disputed` have no Dashboard surface
- A demote-then-re-cue can send a guest "up next" twice

**Next phase after 6A Tier 3: Admin / CRM redesign.** Its own dedicated
phase, not part of 6A. The growth pipeline currently lives in a markdown
file maintained by hand; `/admin` exists but was built for DJ oversight and
not-played reports rather than acquisition. Scope to be defined when the
phase starts.

---

## 4. Beta readiness

Only things that materially affect safely continuing or expanding the
current beta.

- [ ] **6A Tier 3** — booth usability and accessibility on a real device
- [ ] **Authenticated QA still outstanding after Tier 3a.** Each needs
      either a multi-step flow that changes live state or hardware:
      - Payments click-through (onboarding, return, refresh, Manage in
        Stripe, the `onboarding_incomplete` fallback)
      - Post-gig recap trigger
      - Paused-requests behaviour
      - Real-device mobile keyboard journey
      - Breakpoint checks at 320 / 430 / 768 / 1440. 390 is measured and
        clean; Chrome's minimum window width is 500px, so the others need
        the DevTools device toolbar set per width
- [ ] **The activation problem.** 14 external signups, **zero activated**.
      Five DJs are onboarded and payments-ready and have never taken a
      request.

      **Updated 2026-09-01.** Sweenz said he would try it over the
      weekend and Steve said he would test it at his sports-bar sets.
      **No song request has been created since 28 August.** Neither
      attempt produced one, and the three follow-up tasks — Sweenz, Cammy
      Birse and Ben Phillips, all due 31 August — are overdue and
      unanswered. Asking those two what actually stopped them is the
      highest-value action available and is not engineering work.

      **Also 2026-09-01:** `djbadja` signed up on 31 August and completed
      onboarding *and* connected Stripe the same day — the first DJ to do
      the entire technical journey unprompted, from a cold prospect with
      no recorded status. How they found Playing Next is unknown and
      unknowable: there is no acquisition-source column and no
      attribution of any kind. The first known blocker is **not the product**:
      one DJ asked a club for permission to use Playing Next and management
      refused. Treated as a single case, not a pattern, until others report
      back. See [GROWTH_CRM.md](GROWTH_CRM.md)
- [ ] **Rate limiting is in-memory per-process**, not shared across
      instances. Fine at beta volume, not beyond it

---

## 5. Public launch readiness

### Product / technical

- [ ] **Data retention and erasure. Partially built; the destructive half
      is BLOCKED.** Decided 2026-08-31.

      **Built and live, all non-destructive:** a payment classification
      that fails closed (`src/lib/retention.ts`, no I/O), the R1-R4 rules
      as a report-only panel under Reports, and a manual privacy-request
      workflow with Stripe and attribute lookup, ownership verification
      and server-authoritative classification. `data_erasures` is applied
      and append-only; `customer_name` is dropped.

      **Blocked — requires backups before Production execution can be
      enabled.** Nothing destructive can run:
      `ERASURE_EXECUTION_ENABLED` and `RETENTION_EXECUTION_ENABLED` are
      both unset, and no automatic executor exists.

      **`erase_personal_fields` is applied to Production**
      (`20260831_erase_atomically.sql`, 2026-08-31) and was verified
      afterwards read-only: the function exists with the expected
      signature, is SECURITY INVOKER, and its guards are enforced in the
      database rather than in the route. **Applying it did not arm
      anything.** `ERASURE_EXECUTION_ENABLED` remains unset, so
      `POST /api/admin/privacy/erase` returns **503 before it reads the
      request body** and Production manual erasure cannot execute. No
      erasure has ever been run against Production and `data_erasures`
      holds 0 rows.

      **Verification status:** the pure-logic suite passes **46 of 46**
      (`scripts/erasure-rules.test.mts`) covering classification,
      eligibility, references, proofs and the field map. The database
      write-path suite passes **15 of 15**
      (`scripts/erasure-writepath.test.mts`) against the isolated
      Playing Next Test project, covering the transaction, rollback and
      audit contents; it refuses to run against the Production project
      ref with no override. Destructive behaviour is never to be tested
      against Production.

      **Test environment approved 2026-08-31:** a second Supabase Free
      project, `test-environment/erasure/`. It verifies the erasure
      transaction only and proves nothing about Production, because its
      source tables are inferred from the PostgREST description, which
      exposes no CHECK constraints, RLS, grants, triggers or indexes.
      Production security was verified separately against Production.
      Synthetic fixtures only; Production data must never be loaded there.

      Guest access and export remain unbuilt. See
      [DATA_AUDIT.md](DATA_AUDIT.md) §5.
- [ ] **Database backups and recovery.** Needs the Supabase Pro upgrade,
      **which Elliot declined on 2026-08-31 as unjustifiable right now.**
      This is the single gate on arming any destructive retention or
      erasure. Do not work around it, and do not weaken the safety
      requirements to avoid it.
- [ ] Rate limiting shared across instances
- [ ] Signed subscription webhook delivery QA via the Stripe CLI
- [ ] One Preview Free to Pro checkout in a browser
- [ ] Confirm every Stripe variable in Vercel Preview points at sandbox

### Legal / compliance

Verified as required:
- [ ] **ICO data protection fee.** £52/year, £47 by direct debit. We process
      personal data electronically and qualify for no exemption.
- [ ] **Geographic address on the Privacy Policy.** UK E-Commerce
      Regulations 2002 require a contact address. Deferred by explicit
      choice for the beta; needs a virtual mailbox or a real address.
- [ ] **Privacy and cookie wording for advertising measurement**, before any
      ad tag is installed. The current policy covers analytics only.

Requires professional confirmation:
- [ ] **Payments regulation / Stripe Connect legal review.** The single
      biggest open legal risk: whether Playing Next needs its own FCA
      registration or is properly exempt given how Connect is structured.
      Needs a solicitor who knows UK payments regulation.
- [ ] **Solicitor review of all four legal documents.** DJ Terms, Guest
      Terms, Refund Policy and Privacy Policy are all still marked
      "Draft — not yet legally reviewed".
- [ ] VAT and accounting advice. Registration is mandatory only above
      £90,000 rolling turnover, but Stripe fees and the 15% cut make the
      bookkeeping non-trivial well before that.

### Business / operations

- [ ] **Company structure decision.** Sole trader or Ltd. Gates the bank
      account, the ICO registered name and the trademark. The Ltd path was
      abandoned mid-registration during the beta over the public
      registered-office record.
- [ ] Business bank account, separate from personal, whichever structure
- [ ] If sole trader: register with HMRC by 5 October following the tax year
- [ ] Trademark registration. Optional. UK IPO search came back clear but
      nothing is reserved until filed.

---

## 6. Growth and Go-To-Market

A first-class workstream, not a product afterthought.

**The live pipeline is the Admin CRM at `/admin`,** as of 2026-08-29.
Contacts, outreach status, activation blockers, follow-ups and notes are
maintained there and join automatically to `dj_profiles` and
`song_requests`; lifecycle stage is derived by `src/lib/djLifecycle.ts`
and is never stored. [GROWTH_CRM.md](GROWTH_CRM.md) is now the historical
record and the growth strategy, not a second live pipeline to keep in
sync. This section holds strategy and technical dependencies.

**Behavioural analytics exists. Acquisition and conversion attribution does
not.** These are not the same thing and the distinction matters: we can see
what people do once they arrive, and nothing about where they came from.

**And acquisition is not currently the constraint.** A 23-person pipeline
has produced 8 signups; none of the 14 external accounts has ever taken a
request. Widening the top of the funnel before the first-use step works
would buy more of a step that has never once been crossed. The measurement
work below is still worth doing first, because it is what makes any future
spend legible.

**One signal to watch, not yet a pattern.** The only DJ who has actually
attempted to use Playing Next was refused permission by the club's
management. If that turns out to be common it affects where activation
effort belongs (mobile, private and wedding work rather than club
residencies) and gives the parked venue/promoter B2B workstream a concrete
reason to exist. One case is not evidence; see
[GROWTH_CRM.md](GROWTH_CRM.md) §8.

### Foundation — DONE

- Google Tag Manager (`GTM-TC39K44W`)
- GA4 (`G-38M024J044`) via GTM's Google Tag, verified live in Realtime
- Microsoft Clarity, consent-gated through GTM
- Consent banner and Google Consent Mode **for analytics**
- QR-led organic acquisition capability: Display Screen, printable table
  card, booth sign and lock-screen formats

### Beta growth

Operational detail, the 23-person pipeline, blockers and learnings live in
[GROWTH_CRM.md](GROWTH_CRM.md). Do not duplicate them here.
- [ ] **Activate the four payments-ready DJs** — the single highest-value
      growth action available. Five follow-ups sent 2026-08-28
- [ ] DJ recruitment and outreach
- [ ] Prospect and follow-up list
- [ ] Social positioning, Instagram bio and presence
- [ ] LinkedIn company page, tagline, and Elliot's own title
- [ ] Marketing creatives
- [ ] Organic QR distribution at gigs

### Measurement before paid acquisition

Every item here is currently **missing**, verified against the code.

- [ ] **Advertising consent option.** `ads: false` is hardcoded in both
      branches of `ConsentBanner.tsx` (lines 45 and 53) and the layout's
      returning-visitor restore hardcodes all three ad signals to denied.
      No user can consent to ad measurement today. `updateConsent()` in
      `src/lib/consent.ts` already handles the `ads` category correctly, so
      the bridge exists and is simply never called with `true`.
      **Hard blocker on any paid acquisition.**
- [ ] **GA4 business/key events.** Zero custom `dataLayer` pushes exist in
      app code. GA4 sees only automatic Enhanced Measurement.
- [ ] Signup attribution
- [ ] Onboarding-complete attribution
- [ ] Pro upgrade attribution
- [ ] **First-request / activation event.** Decide the definition first;
      see the activation question in [GROWTH_CRM.md](GROWTH_CRM.md)
- [ ] UTM persistence through signup
- [ ] `gclid` / `fbclid` capture where appropriate
- [ ] **Acquisition source persistence.** `dj_profiles` has no utm, source,
      campaign or referrer column
- [ ] Google Ads conversion setup. No `AW-` tag exists
- [ ] Meta Pixel. No `fbq` exists
- [ ] Privacy and cookie wording for advertising measurement

### Paid acquisition

- [ ] Google Ads
- [ ] Meta Ads
- [ ] **Landing destination decision** — ad to signup, or ad to a marketing
      page. Interacts with the homepage redesign
- [ ] **Optimisation event decision** — which single event paid spend is
      optimised against
- [ ] Initial test budget and channel decision

**Sequencing, recorded deliberately:** meaningful paid spend should wait
until attribution and consent are working and the acquisition to signup to
onboarding funnel is measurable. Small controlled acquisition experiments
may form part of beta validation once those foundations are ready. This is
not "after the beta ends"; it is "after we can measure it".

### Scale

- [ ] Retargeting audiences
- [ ] Meta Conversions API, if pixel volume justifies server-side
- [ ] Dedicated paid landing pages, sequenced after the homepage redesign
- [ ] Referral programme (currently parked)
- [ ] Venue, promoter and B2B acquisition (currently parked)

---

## 7. Post-launch product

- [ ] **Guest push notifications.** DJ push is shipped; the guest side is
      not. Seven open design questions: binding a subscription to
      locally-owned requests, one device holding requests for several DJs,
      which transitions justify interrupting someone, notification fatigue,
      revoke and unsubscribe, a privacy review of the endpoint as a durable
      identifier, and the iOS add-to-home-screen reality check.
- [ ] **Guest-side notification when a status changes while they are not on
      the page.** Flagged during the 2026-08-19 notes work, never actioned.
- [ ] **Abuse controls for repeated or false "wasn't played" reports.**
      Policy-only today; no technical control.
- [ ] **Email design system.** A shared layout, branding, mobile and
      dark-client resilience, restyling the two QR box emails, porting the
      three Supabase Auth templates, the missing transactional emails, a
      professional signature, and the sending domain with SPF/DKIM/DMARC.
- [ ] Homepage redesign, remaining passes. The hero is done; unifying
      Pricing, Features, Dashboard Showcase and the guest/DJ experience into
      one continuous narrative is not.
- [ ] DJ profile redesign. Sequenced after the homepage so both share one
      design system.
- [ ] `/api/stripe/connect/payouts` writes to Stripe on every Earnings load
- [ ] Cached payout health so Settings can distinguish "Ready" from
      "Action required"

---

## 8. Future / scale

### Venue Mode / DJ check-in

A stated future mode for the platform, recorded 2026-09-01. Not approved
work and not scheduled; written down so the shape is not re-derived.

**The core idea.** A DJ checks in to the venue they are playing.
Playing Next associates that venue with the currently active DJ. A guest
can then find their venue and reach whoever is playing there, instead of
having to identify the DJ by name or scan that DJ's personal QR.

**Why it is interesting.** Every route to a guest today runs through the
individual DJ - their slug, their QR, their printed card. That works when
the guest already knows who is playing and is standing near the booth. A
venue is the thing a guest actually knows they are in. It also makes the
QR a property of the room rather than of the person, which is what makes
a permanent fixture possible.

**Longer-term potential**, in rough order of dependency:

- a permanent venue QR, printed once and left in place
- venue pages and venue accounts
- resident-DJ management, so a venue can say who plays there
- venue-approved requests
- venue-level analytics, and a B2B offering built on it

**Relationship to existing decisions.** The venue/promoter B2B accounts
workstream stays **parked** (§9) - this does not un-park it. Venue Mode
is the DJ-side capability that would have to exist first, and it is the
half that needs no venue to sign anything.

It also connects to the only activation blocker anyone has actually
reported: on 2026-08-28 a club's management refused permission for
Playing Next to be used at a set. If venue permission turns out to be a
pattern rather than one case, a mode where the venue is a participant
rather than an obstacle stops being a scale idea and becomes the answer
to the thing blocking activation. That is a reason to keep watching the
blocker data, not a reason to build this yet.

**Dependencies worth naming before anyone starts.** There is no venue
entity in the schema at all; `dj_events` exists, holds an event `name`,
and has **zero rows**, so even the nearest existing concept is unadopted.
"Currently playing here" needs a durable notion of an active session,
which today is `session_started_at` and is cleared when a DJ pauses -
one of the three competing definitions of "a night" already logged as
technical debt in §11.

- [ ] **Events gig-day semantics.** An event is the right boundary for
      "which night is this" because it survives midnight. Migrating Tonight,
      Earnings Today and Analytics onto it needs real adoption (the table
      has zero rows) and a durable event start timestamp.
- [ ] Per-event analytics
- [ ] Scheduled event start times and capacity overrides
- [ ] Annual Pro billing
- [ ] Guest queue voting. The one competitor feature we lack.
- [ ] Music library integration and sync
- [ ] Shared rate limiting, if traffic warrants
- [ ] Proper test runner

---

## 9. Parked

Deliberately postponed. Each records the reason and who decided.

| Item | Reason | Decided |
|---|---|---|
| Do-Not-Play list | Explicitly parked by Elliot | Priority 1 notes |
| Explicit lyrics / content toggle | Explicitly parked by Elliot | Priority 1 notes |
| Automatic decline by genre or rules | Never started, no demand | Priority 1 notes |
| Stripe payout-hold automation | Real money-movement automation on a live Connect account; meaningfully riskier than the reporting mechanism | 2026-08-19 |
| Referral programme | Elliot's call, do not build without being asked again | 2026-08-14 |
| Venue / promoter B2B accounts | Same | 2026-08-14 |
| Light theme for the DJ profile | Contradicts the dark nightlife brand | 2026-08-19 |
| Language / i18n | No international demand yet | 2026-08-19 |
| NFC in the v1 physical product | Hardware complexity; ship QR only first | 2026-08-19 |
| Limited company registration | Abandoned mid-flow over the public registered-office record | Beta |
| Music library sync | Long-term idea, not started | Priority 1 notes |

---

## 10. Ideas / undecided

Discussed, never approved. These are not work.

- Physical QR block as a standing Pro perk. **The only decision made is the
  launch promotion**: the first 50 DJs to go Pro get a free block and
  shipping. Making it an entitlement has been considered and **not decided**.
- Annual Pro billing pricing. Roughly two months free was discussed. No
  price is approved and no annual Stripe Price exists.
- Guest queue voting
- Sortable columns and CSV export in `/admin`
- Server-side GTM container. Recommended against previously: large, costly,
  and the evidence for it was wrong.

**Future Pro candidates, candidates only, none approved:** custom DJ
branding, per-event analytics, advanced request rules, priority support.
Do not silently turn a roadmap idea into a Pro entitlement.

---

## 11. Technical debt

| Item | Detail |
|---|---|
| 3 pre-existing lint errors | `spotify/search/route.ts:99,102`, `ConsentBanner.tsx:41` |
| No test runner | Two hand-rolled `node:test` scripts; no `npm test` |
| Connect payout write-on-read | `/api/stripe/connect/payouts` calls `accounts.update` inside a read path |
| Cached payout health | Settings cannot distinguish healthy from payout-held |
| Least-privilege DML cleanup | `anon` and `authenticated` hold INSERT/UPDATE/DELETE/TRUNCATE on public tables. RLS neutralises them, verified by probe; the grants themselves were never tidied |
| Rate limiting | In-memory per-process |
| Sentry | ~98 KB on every route, ~1.1s of the critical path. `enableLogs: true` with zero `Sentry.logger` calls anywhere |
| Three definitions of "a night" | `session_started_at` drives the recap, the browser-local calendar day drives Tonight and Earnings, the active event drives pricing |
| Migrations vs Production | Applied by hand in the Supabase SQL editor; no migration tooling or DB credentials available to the repo |
| **Schema is not reproducible from the repo** | Only 5 of 13 tables have a `create table` in `supabase/migrations`. **Not solved by `test-environment/erasure/schema.test-only.sql`** — those definitions are inferred, incomplete by construction, and must never be promoted into `supabase/migrations`. Inferred definitions presented as history would be worse than the honest absence. `song_requests`, `tips`, `dj_profiles`, `qr_box_orders`, `chargeback_disputes`, `push_subscriptions` and `dj_events` predate the checked-in migrations and exist only in Production. This is what stops a second database being stood up from source, and it is the same reason there is no way to recreate Production if it were lost |
| **Dashboard CLS 0.5494** | Found during Tier 3a verification, **pre-existing and not introduced by it**. One layout shift at 766ms on the authenticated dashboard: the `DashboardSkeleton` to real-content swap, with `DIV.flex.min-w-0` jumping from top 393 to top 0. Measured at 390x1340 with 5 pending. Good is under 0.1. The guest page measures 0, so this is specific to the skeleton architecture here. Fixing it means either reserving the real layout's dimensions in the skeleton or holding the swap until content is ready. Not attempted |
| ~~Growth pipeline is a markdown file~~ | **Resolved 2026-08-29.** The 23-person pipeline migrated into `crm_contacts`; 7 linked to real profiles, 16 left unlinked. The Admin CRM joins to `dj_profiles` and `song_requests` automatically, so no hand reconciliation remains. `GROWTH_CRM.md` is now historical |

---

## 12. Legal and policy register

**Verified as required:** ICO fee, geographic address on the Privacy
Policy, advertising cookie wording before any ad tag, HMRC registration if
sole trader.

**Requires professional confirmation:** FCA / payments regulation review,
solicitor review of all four documents, VAT and accounting advice,
trademark.

**Product or code implication:**
- **Data retention and erasure: mechanism built, execution disabled.**
  Both data minimisation and the right to erasure are UK GDPR
  requirements, and as of 2026-08-31 Playing Next has a mechanism for
  each rather than none. A manual privacy-request workflow can locate a
  subject's records, verify ownership, classify them server-side and
  clear the personal fields in one transaction with an append-only audit
  record; the retention rules R1-R4 exist as a report. What is **not**
  in place is any of it running: both execution flags are unset, there
  is no automatic executor, and Production erasure returns 503. The
  compliance position is therefore that a request could be answered by a
  deliberate act, not that data is being minimised automatically.
  Arming either half waits on database backups (§5). Guest self-service
  access and export remain unbuilt.
- Notification permission wording
- Advertising consent must exist in the UI before ad measurement is legal

**Already resolved and documented (2026-08-19):** the not-played report and
refund path, refunds as discretionary and pattern-based rather than an
entitlement, dispute handling, payout timing, Events, tips, cancellation,
and the request status lifecycle in Guest Terms.

---

## 12a. Onboarding recovery emails. R1 SHIPPED, 2026-09-02.

Nine external DJs had created an account and stopped before they could
take money. Nothing reached out to them. Now something does, once, and
then once more, and then never again.

**What is built and live**

- A minimal shared email layout (`src/lib/emailLayout.ts`): presentation
  tables, inline styles, a system font stack, a plain-text alternative
  generated from the same content object, and the real brand lockup.
  This is the foundation §7 asked for and is deliberately no more than
  that.
- **Six templates**: R1 and R2, each in three state-aware variants,
  rendered from live product state rather than from a stored flag.
- `src/lib/recoveryEligibility.ts`, pure and clock-injected. It computes
  A/B/C from the profile fields directly, because `onboarding_complete`
  includes `stripe_connected` and therefore cannot express "profile
  finished, payouts missing" at all.
- Claim, compare-and-swap retry and settle (`lifecycleEmails.ts`) over
  `dj_lifecycle_emails`, plus category-scoped suppression with one-click
  unsubscribe.
- An admin-only test route whose recipient comes from the verified
  session and which writes no delivery row.
- A fourth PN Admin timeline kind for delivery history, never an input
  to lifecycle.

**The R1 backlog, sent 2026-09-02 20:57 UTC.** Nine DJs, six in state A,
two in C, one in B. All nine claimed, sent and delivered: zero failures,
zero uncertain rows, zero duplicates, every row at `attempts = 1`. Sent
by `scripts/send-recovery-backlog.mts`, which is dry-run by default,
refuses any argument other than `--execute`, cannot send R2, cannot name
a recipient, and re-checks eligibility from Production immediately before
each individual claim.

**Deliverability gate, passed before sending.** SPF, DKIM and DMARC all
confirmed PASS from the delivered message's own headers rather than from
DNS configuration alone. Sender and Reply-To are
`info@playingnextapp.com`, a monitored mailbox, so R2's offer to reply is
true. No open or click tracking is enabled and every link in every
variant resolves to `playingnextapp.com`.

**Measurement, first-party. Decided and built 2026-09-02.**

Resend's open and click tracking are **off and staying off**. Opens are
a 1x1 pixel, six of the nine recipients sit behind Gmail or Apple image
proxies, and clicks would rewrite every link through a tracking
subdomain while recording an IP address and a user agent per click. The
number would have been uninterpretable and the cost was real.

What was built instead measures the half that matters, from the only
place it can be known honestly: a DJ, signed in as themselves, arriving
on the page the email pointed at.

- `?from=recovery_1` and `?from=recovery_2` distinguish an email click
  from the four in-product buttons that also produce `?from=onboarding`.
  That collision is precisely why the first nine can never be
  attributed.
- `returned_at` records the first such arrival, write-once in the
  database as well as in the application, so a repeat visit cannot
  inflate it and a later edit cannot move it.
- `return_tracked` separates "did not come back" from "cannot be known".
  The nine are false, and Reports says "9 sent, returns not measurable"
  rather than inventing a zero.
- **No pixel, no link rewriting, no IP, no user agent, no third party.**

**Delivery, from a signed webhook. Live 2026-09-03.**
`/api/webhooks/resend` accepts five delivery events and refuses
everything else, including opens and clicks, which are absent from its
map rather than merely disabled upstream. It verifies with `svix`, fails
closed with no secret or a bad signature, never reads or logs the
recipient, and returns a silent success for message ids it does not
recognise, because the QR box emails share the Resend account.
`delivery_state_at` is the provider's own event time from inside the
signed body. Duplicate and out-of-order events are absorbed by the
database's forward-only rank rather than by handler logic.

Verified against the deployed endpoint by watching a forged request move
from 500 (no secret) to 400 (signature rejected), with the target row
unchanged. **Nothing was emailed to test it.**

**Contact Activity, in human language.** One grouped item per email
carrying the subject the DJ actually received, the state they were in
when it went, and every known delivery fact on one line. `recovery_1`,
`recovery_2`, A, B and C never reach a screen. Unknown facts are omitted
rather than rendered as zero: the nine show `Sent 21:57 · Delivered`
with no clock, because Resend reports their state but not the moment.

**Not done, deliberately**

- **R2 has never been sent.** The templates exist and the rule is
  written; the first R2 is not due until a recipient reaches day 10 and
  six days past their R1. It will also be the webhook's first real
  exercise.
- **No cron is armed.** There is no scheduler at all, so nothing sends
  without somebody running it.
- The Ready-to-activate sequence is a separate future workstream and was
  kept out of this one on purpose.
- The nine cannot gain a delivery time retroactively. Webhooks fire only
  for mail sent after the endpoint existed, and their subjects and
  delivered state were backfilled from Resend's own records rather than
  rebuilt from template code, which had already changed.

## 13. Open decisions for Elliot

1. **Financial-record retention period.** The retention policy itself is
   settled and built (90 days for guest message text, erasure by
   anonymisation, R1-R4 as rules). The one piece still undecided is how
   long records that carry money must be kept before anything may touch
   them. It is deliberately **not** an application constant: no such
   figure exists anywhere in the code, and none should be invented here.
   It depends on UK tax and accounting obligations and on the company
   structure decision below, so it needs accounting or professional
   advice rather than a product decision. Until it is settled, every
   money-bearing row classifies as `preserve` and is never eligible for
   anything destructive, which is the correct behaviour while the answer
   is unknown.
2. **Company structure.** Sole trader or Ltd. Gates several other items.
3. **Ad landing destination.** Signup or marketing page.
4. **Paid optimisation event.** Which single event spend is judged on.
5. **Sentry.** `enableLogs` is on with no logger calls. Recommendation:
   drop it, keep tracing and error capture.
6. **Annual Pro billing.** Defer until Pro has real subscribers.
7. **Physical QR block.** Keep as a launch promotion, or promote to an
   entitlement.
8. **Guest queue voting.** Post-launch or never.

---

## 14. Invariants — what future work must not regress

**Performance baseline** (Production, 700kbps / 300ms RTT, warm):
| Metric | Value |
|---|---|
| DJ identity visible | ~1.5s |
| First keystroke accepted | 4.4–4.7s |
| Initial critical JS | 259.4 KB |
| CLS | 0 |

Below about 3s is not reachable at this connection speed: Next's own
runtime is ~158 KB, roughly 1.8s of transfer before any of our code loads.

**Two costs accepted deliberately.** The guest route is dynamic, not
CDN-cached, because it renders live prices and a stale price a guest is
quoted but not charged is worse than a cache miss. TipCard's space is
reserved at a measured 62px so its code can load late without shifting the
page; if that card's collapsed height changes, the reservation must change
with it.

**Security invariants:**
- `anon` holds SELECT on 12 named columns of `dj_profiles`, never the table
- `plan`, `stripe_subscription_status`, and every Stripe identifier return
  401 to `anon`
- `dj_events` is not readable by `anon` or `authenticated`
- The public bootstrap view's select list is the complete public boundary
- `is_pro_entitled` **must** keep EXECUTE for `anon`. A plain SQL function
  called inside a view runs with the caller's privileges. Revoking it took
  the guest page down on 2026-08-28. Lock it down with SECURITY DEFINER if
  ever needed, never by revoking the grant.
- Two test suites guard this: `scripts/public-bootstrap-security.test.ts`
  (7 tests) and `scripts/entitlement-parity.test.ts` (5 tests)

**Dashboard accessibility baseline** (390x1340, authenticated, after
Tier 3a). Future work must not regress these:

| Check | Value |
| --- | --- |
| WCAG AA contrast failures | **0** of 41 elements checked |
| Interactive targets below 44px | **0** at 0, 1, 5 and 8 pending |
| Modal: focus moves into dialog | Yes |
| Modal: Pause reachable while open | **No** (inert) |
| Modal: Escape closes, focus restored | Yes |
| Accept/Decline separation | 16px |
| Horizontal overflow | None, including a 60-char unbroken artist name |

`--color-text-muted` (#8b8b93) is the floor for muted operational text.
Anything dimmer fails AA on our surfaces: zinc-500 measures 3.76-4.15:1
and zinc-600 2.35-2.59:1. Do not reintroduce either for dashboard text.

**PN Admin dialog invariants** (from the 6C P0, proven on Production with
`elementsFromPoint` at the centre of every control):

- A dialog's inert marking is taken **once, when it opens**. Any effect
  that re-marks on re-render will mark a sheet that mounted after it,
  which is what made **+ Task** untouchable. `useModalA11y` therefore
  depends on `open` alone and reads `onClose` through a ref.
- **Only the topmost dialog marks anything inert**, decided by a
  mount-order stack. Document order is not a proxy for stacking: the task
  sheet renders before the contact drawer and opens above it.
- A dialog never captures a return-focus target **inside itself**. React
  applies `autoFocus` during commit, before passive effects, so the naive
  capture records a node the dialog is about to unmount.
- Dialogs declare initial focus with `data-autofocus`, not `autoFocus`,
  so the hook can record where focus came from before moving it.
- No sheet may be rendered inside an `inert` ancestor. `pointer-events`,
  `aria-hidden` and z-index were all measured and were never the cause;
  do not reach for them when a control goes dead.

**CRM model invariants:**

- Contacts groups are the lifecycle stages, read off `row.stage`. Only
  New signups is derived here, and only from "an account with no
  `crm_contact`, not internal". Every row must land in exactly one group
  and the counts must sum to the total.
- `rowIdentity` is the only human-facing name in PN Admin: real DJ name
  unless it is the `New DJ` default, then CRM `display_name`, then slug.
  `displayIdentity` is for the link pickers alone, where no contact
  exists by definition. The same person must never carry two names across
  Contacts, Tasks, Overview, search and sorting.
- Linking is one operation, `performLink`, from either direction. It
  attaches `dj_profile_id` and writes nothing else. Never fuzzy, never by
  email, never by name similarity, always explicitly confirmed.
- `next_gig_date` is written by its own control and nothing else. It has
  never held a value inferred from any other date and must not start.
- Nothing writes `outreach_status` automatically. `signed_up` and `lost`
  are retired from the UI but remain valid in the CHECK constraint, and a
  stored legacy value must keep rendering so saving cannot rewrite it.
- Save changes writes only the fields its form displays: never tasks,
  `last_contact_at`, notes, lifecycle, or the legacy columns.

**Retention and erasure invariants** (Phase 6D, 2026-09-01):

- **Nothing destructive may run without an explicit decision.** Both
  execution flags must be present AND exactly `"true"`; every other value
  and their absence mean disabled. There is no reading that fails open.
- **Backups gate arming.** No automatic retention rule and no Production
  erasure is enabled until database backups exist and Elliot approves.
- **Never delete a row to satisfy an erasure request.** Clearing the
  personal field satisfies it; removing the row is minimisation, a
  different obligation with its own gate.
- **A missing `stripe_fee` never means unpaid.** It is written
  conditionally on capture; 51 of 65 `played` rows carry none. Never use
  `stripe_fee`, `total_amount`, request status or PaymentIntent presence
  individually as proof of payment state.
- **Locating a record never authorises erasing it.** DJ, date and song
  identify a row and prove nothing about who is asking.
- **The audit log records field names, never values**, and holds no guest
  identifier. It is append-only and must stay that way.
- **Production verification is read-only.** Destructive and write-path
  testing happens in the Playing Next Test project, on synthetic data
  only. Production personal data must never be loaded there.
- **Never store a guest email in Supabase to make erasure easier.** The
  bridge is Stripe, and it stays there.

**Lifecycle email invariants** (§12a, 2026-09-03):

- **No provider tracking.** Resend open and click tracking stay off. No
  pixel, no rewritten links, and no IP address or user agent stored
  anywhere in Playing Next. Engagement is measured first-party or not
  at all.
- **A DJ cannot receive the same lifecycle email twice.** Enforced by
  the unique index on `(dj_profile_id, template_key)`, not by an
  application check that two concurrent runs would both pass.
- **Uncertainty is never resolved by sending again.** A `claimed` row
  whose provider outcome is unknown is never retried automatically.
- **`sent` and `returned_at` are final**, both by database trigger. A
  sent email cannot be reopened and a first return cannot be moved or
  cleared.
- **Never invent a date.** A known event with no provable time is shown
  without one, or omitted where an undated entry would be misleading in
  a chronological list. Nothing is back-dated to `now()`.
- **Never count an unknowable return as zero.** `return_tracked` exists
  solely to keep the nine untracked sends out of any rate.
- **Internal identifiers stay internal.** `recovery_1`, `recovery_2`, A,
  B and C never appear in the CRM or in an email.
- **Eligibility comes from product state**, never from `crm_contacts`,
  `outreach_status`, a task or a note, and is re-read immediately before
  every send.

**Financial invariants:** stored snapshots are never recomputed; Dashboard
Tonight equals Earnings Today on the same local-day basis; Accept captures
exactly once; Decline never captures; a full queue never captures.

---

## 15. Completed work

**Phase 4 and earlier** — guest request journey, Spotify search, VIP,
duplicate detection, cancellation, My Requests, Display Screen, QR codes and
printable formats, DJ notifications, post-gig recap, admin area, not-played
reporting, consent banner, GTM, GA4, Clarity, motion system, homepage hero.

**Phase 5** — 5A/5A.1 Earnings and the `dj_hidden` fix (`5ebc73a`,
`804e316`); 5B Analytics (`c21b567`); 5C Settings (`7086e79`, `09824bf`);
5D Connect health (`53f3cd7`) and the `stripe_connected` backfill;
5E Events Mode (`3562b84`); 5F Plans and entitlement (`54bddab`, `6a81963`,
`f61e474`, `e80a9cb`); Pro feature history audit and documentation
correction (`dce9e4c`).

**Production incident, 2026-09-03** — guest pages read a column `anon`
cannot; fixed by removing it rather than granting it (`1474df1`).

**Performance** — `lhr1` region (`e2a113f`), avatar optimizer and Geist Mono
(`ccaac6f`), GTM afterInteractive (`3a5776c`), CDN shell then dynamic
(`d309a59`), server-rendered DJ through the public Postgres boundary
(`5c655de`), Supabase/Motion/obscenity/Sonner deferred (`852e11c`,
`de384eb`, `f163f84`). Baseline recorded (`278ebd1`).

**Security** — public bootstrap view and entitlement in Postgres, `anon`
`dj_events` revoke, EXECUTE grant corrections (`97f2801`), two test suites.

**Phase 6A Tier 3a** — modal focus and keyboard safety, contrast 12
failures to 0, Accept/Decline spacing, zero-pending state, queue live
region, Clear History accessible name (`ce18937`, `8818ccc`). Verified on
the live authenticated dashboard at 390px.

**Phase 6A Tier 1 and 2** — server-authoritative Accept (`7218a80`),
transition guards, Playing Next invariant and Dashboard error states
(`caf02c8`), fallback removal (`512d717`). Five two-device tests passed on
Production with Stripe confirming the correct capture count.

**Phase 6B — Admin and CRM** — `crm_contacts` and `crm_notes` with RLS on
and no policies (`20260828`), `crm_tasks` and three write-once lifecycle
timestamp columns (`20260830`), Overview / Contacts / Tasks / Reports, the
PN Admin PWA, the mobile UX pass, tasks made authoritative (`15a116d`),
one scheduling model everywhere (`34c6a2c`), and refresh-on-return with a
freshness indicator (`03d24c5`). The 23-person pipeline migrated.

**Lifecycle email measurement** — first-party return attribution and the
cohort-honesty flag (`18129cf`), the extended migration and
`profile_completed_at` (`4a1de6f`, `b72593f`, `251a494`), the grouped
Activity item and the backfill of the nine from Resend's own records
(`c5f35cf`), and the signed delivery webhook (`44dffc7`). No provider
tracking was enabled at any point.

**Onboarding recovery emails** — the shared layout and six state-aware
templates, eligibility and the claim/settle model (`b8ac585`), the
contrast and copy pass after reading one on a phone (`67316ef`), the
brand lockup and CTA hierarchy (`5e49bfe`), and the backlog script
(`b49ef5e`). R1 sent to nine DJs on 2026-09-02; R2 and the scheduler
deliberately do not exist yet.

**Phase 6D — Data retention and erasure** — the classification and
report-only rules (`9de5dac`), the privacy-request workflow (`f7e9ecb`),
`data_erasures` made genuinely append-only after a GRANT was found not to
withhold (`91c3ac3`), the clear and its audit made one transaction
(`930526f`), the test-only fixture schema (`f3c8450`), and the write-path
suite completed to 15/15 (`6391ec6`). Three migrations applied to
Production and verified; everything destructive left disabled.

**Phase 6C — CRM operating model** — the **+ Task** P0 and the two dialog
bugs its verification exposed (`7a60147`, `49c9fd8`), optional Next gig
and a sticky Save changes, the grouped Contacts directory (`f98d0be`),
badges only where they say something new (`b229450`, `acf1123`),
account-side linking through one `performLink` (`f1389de`), the
closed-by-default single-open accordion (`713f247`), A–Z inside each group
(`2d90bb9`), and one authoritative human-facing identity (`cd85d23`).
Every step verified on Production against the real 32 rows, with
temporary labelled records removed afterwards and counts shown returning
to their previous values.
