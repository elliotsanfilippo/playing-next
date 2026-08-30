# Playing Next — Growth & CRM

> ## What this file is, and what it is not
>
> **This is the growth strategy, the historical outreach record, the
> activation learnings and the experiment log.** It is not a CRM, and it
> has not been one since 2026-08-29.
>
> **`/admin` is authoritative** for every live operational fact: contacts,
> tasks, notes, activation blockers, outreach state, the prospect-to-
> account link, and the Playing Next lifecycle. If this file and the Admin
> disagree about a person, the Admin is right.
>
> **Every count and every per-person status printed here is a historical
> snapshot.** They were true on the date beside them and are not
> maintained. Do not manually sync them, and do not read them as current
> — read the Admin. Where a figure has since been superseded it carries a
> dated correction rather than being rewritten, because the reasoning
> that followed from it is part of the record.
>
> **Nothing here should be deleted.** The reasoning, the definitions, the
> channel work, the activation blocker learnings and the growth decisions
> are still current and still belong here. Sections 1, 3 and 5 are frozen
> snapshots by design.
>
> | | |
> |---|---|
> | Migrated 2026-08-29 | 23 contacts |
> | Linked to a real DJ profile | 7 |
> | Left deliberately unlinked | 16, including Tarz |
> | Live pipeline | `/admin` → Contacts |
> | Live tasks | `/admin` → Tasks, from `crm_tasks` |

[ROADMAP.md](ROADMAP.md) §6 holds the Growth workstream and its technical
dependencies. This file holds the strategy, the channel work and the
history; the Admin CRM holds the live pipeline.

**Why it was a markdown file.** Deliberately, while the pipeline was 23
people and the product could not yet describe a person who had not signed
up. No HubSpot, no Salesforce. That constraint ended when `crm_contacts`
shipped and could represent a prospect with no account.

**When you contact somebody, log it at `/admin`.** Open their contact and
use Log interaction; it writes the note and advances `last_contact_at`,
and a follow-up becomes a task with a date. Nothing in this file needs
touching. The only reason to edit this document is a growth learning, an
experiment result, or a channel decision.

---

## 1. Growth status

> **Snapshot, 2026-08-28.** Not maintained. `/admin` → Overview carries
> these live. Corrections since are marked inline.

*Database figures read from Production on 2026-08-28. Outreach statuses
supplied by Elliot from planning that predates these records.*

| | |
|---|---|
| **Total prospects in the pipeline** | **23** |
| Historically signed up | 8 |
| DJ profiles in the database | 16 (~~2 are Elliot's own~~ → **3 are internal**) |
| **External signups** | ~~14~~ → **13** |
| Onboarding complete (external) | **4** |
| **Payments ready (external)** | **4** |
| **Activated external DJs** | **0** |
| Pro subscribers | 1 (Elliot's own test account) |

**Current acquisition stage:** pre-activation, with five follow-ups in
flight. Outreach has produced signups; signups have not yet produced use.

**Contacted 2026-08-28:** Steve / SG Sounds, Tommy Cleary, Sweenz and
Cammy Birse about using Playing Next at an upcoming set, and Ben Phillips
followed up on his incomplete onboarding. **Four of five blockers are
genuinely unknown until they reply.**

**Immediate growth objective:** get **one external DJ to accept one real
paid request at a real gig.** Not more signups. Four DJs are already
technically complete and have never taken a request, so the next win is
activation, not acquisition.

**The headline finding.** Of 16 profiles, most never set a DJ name. Of the
external signups, **zero** have received a single request. Signup is not the
constraint; whatever happens between signing up and standing in a booth is.

> **Correction, 2026-08-30.** A third internal account (`elliot`) was
> identified, so the external count is **13, not 14**, and 9 of 16
> profiles carry the `New DJ` placeholder rather than 10. Neither changes
> the finding: the activation rate is still 0. The three internal slugs
> are listed in `src/lib/internalAccounts.ts` and the Admin excludes them
> from the external funnel.

---

## 2. DJ acquisition funnel

Outreach status and product stage are tracked **separately**. A person can
be historically "Signed up" and currently "Onboarded, payments ready, not
activated" — that distinction is the whole point of this file.

### Outreach stages — manual, and only five of them now

Not contacted → Contacted, awaiting reply → Interested → Signing up →
Not interested

**"Signed up" is no longer an outreach stage.** It was one here, and it
turned out to be a copy of something the product already knew: on
2026-08-30 all seven linked contacts held it and nobody else did, so it
said nothing at all about anyone with an account. Whether somebody signed
up is answered by whether their contact is linked to a `dj_profile`.
"Lost" is gone too — it was never used and never differed from "not
interested". Both remain valid values in the database and no row was
rewritten; they are simply no longer offered.

### Product stages — automatic, never maintained by hand

Account created → Onboarding incomplete → Onboarded → Ready to activate →
**Activated** → Repeat → Pro

These are not a list anybody keeps up to date. `src/lib/djLifecycle.ts`
derives the stage live from `dj_profiles` and `song_requests` on every
load and **stores it nowhere**. Onboarding completion, the Stripe Connect
`account.updated` webhook, a captured paid request and subscription
webhooks are what move a DJ along; nothing in the Admin can set a stage,
and the Pipeline board has no drag handle for exactly that reason.

Two stages in the enum are never the answer: "Signed up" and "Payments
ready", because anyone signed up is always more precisely one of the
stages after it. "Ready to activate" is onboarded **and** payments-ready
**and** no captured request — the group that matters most right now.

### Activation — adopted definition

> **An Activated DJ is an external DJ who has successfully accepted their
> first paid request.**

Later stages are tracked separately: **Activated → Repeat gig/user → Pro**.

Explicitly **not** activation:
- account creation alone
- onboarding completion alone
- Stripe connection alone

By this definition there are currently **zero activated external DJs**.
Four are one gig away from it.

### Activation blocker / reason

Every payments-ready DJ who has not activated carries a blocker. Recording
which one is how we learn whether the gap is the product, the pitch, or
something outside our control entirely.

These are the values the database accepts, mirrored by a CHECK constraint
on `crm_contacts.activation_blocker`:

| Blocker | Meaning |
|---|---|
| `ready_not_attempted` | Set up, has not tried to use it at a gig |
| `venue_refused` | Tried to use it; the venue would not allow it |
| `believes_permission_required` | Assumes they need permission and has not asked |
| `no_suitable_gig` | Willing, but nothing booked that fits |
| `product_or_setup` | Something in the product stopped them |
| `dj_not_interested` | Decided against using it |
| `unknown_awaiting_response` | Contacted, no answer yet |

Two changes from the original list, both deliberate. **"Activated" is not
a blocker** — it is a lifecycle stage, derived from whether money was
captured, and storing it here would create a second answer to a question
the product already answers. And `believes_permission_required` was split
out from `venue_refused`: a venue that said no is a commercial problem,
while a DJ who assumes they need permission and never asks is a messaging
problem. Collapsing them would hide the difference between the two fixes.

A blocker is only recorded once a DJ has actually told us. Until then the
honest value is **unknown, awaiting response**.

---

## 3. DJ outreach and product reconciliation

> **Frozen 2026-08-29 — migrated to the Admin CRM.** Every person below is
> now a `crm_contacts` row. Product stage is derived live at `/admin` and
> the values printed here have already aged; read them as the state at
> migration, not as current. The seven confident profile links were
> applied; Tarz was left unlinked on purpose.
>
> **The "Next action" columns below are dead.** They were the legacy
> `next_action` and `next_follow_up_at` fields, which nothing in PN Admin
> reads or writes any more. Work lives in `crm_tasks` and is managed on
> the Tasks destination, where a task carries a real due date and can be
> completed, rescheduled or deleted. The legacy columns are still in the
> database as rollback data and are operationally retired.
>
> Read this section as evidence of how the beta pipeline was built, not
> as a worklist.

Historical outreach status is Elliot's; product stage is read from the
database. Database evidence can advance someone beyond their historical
status, never downgrade it. **Contact dates and acquisition sources are
deliberately blank — none were provided and none will be invented.**

### Priority 1 — payments ready, never activated

Technically complete. **All four contacted 2026-08-28.**

| DJ | Historical | Product stage | Payments ready | Requests | Activation blocker | Last contact | Next action |
|---|---|---|---|---|---|---|---|
| **Steve / SG Sounds** (`sgsoundsuk`) | Signed up | Onboarded | Yes | 0 | **Unknown — awaiting response** | 2026-08-28 | Asked about using it at his next set. Await reply |
| **Tommy Cleary** (`tommycleary03`) | Signed up | Onboarded | Yes | 0 | **Unknown — awaiting response** | 2026-08-28 | Asked about using it at his next set. Await reply |
| **Sweenz** (`titisweeney97`) | Signed up | Onboarded | Yes | 0 | **Unknown — awaiting response** | 2026-08-28 | Asked about using it at his next set. Await reply |
| **Cammy Birse** (`cameron-birse`) | Signed up | Onboarded | Yes | 0 | **Venue / management refused** | 2026-08-28 | **Tried to use it. The club's management would not allow it.** Now asked whether he has other sets where he could |

**Cammy is not an unused signup.** He attempted to use Playing Next at a
club set and was blocked by that venue's management, not by the product,
the setup, or a lack of interest. He is the only DJ so far who has actually
tried, which makes him the most informative person in this file.

### Priority 2 — signed up, onboarding incomplete

| DJ | Historical | Product stage | Payments ready | Requests | Activation | Next action |
|---|---|---|---|---|---|---|
| **Ben Phillips** (`djbenphillipsmusic`) | Signed up | Onboarding incomplete | **Stripe connected** | 0 | **Unknown — awaiting response**. Contacted 2026-08-28 | Connected Stripe then stopped, the furthest anyone has got before quitting. Followed up; await reply |
| **Sizzla** (`sizzladeejay`) | Signed up | Onboarding incomplete | No | 0 | Not activated | Set a DJ name, no Stripe. Ask what stopped them |
| **Sol / Graeme Smith** (`smithgraeme91`) | Signed up | Onboarding incomplete | No | 0 | Not activated | No name set, 401h idle. Re-engage |
| **Tarz** | Signed up | **No confident profile match** | Unknown | Unknown | Unknown | Confirm which account is theirs, or whether they ever completed signup |

### Priority 3 — signing up

| DJ | Historical | Product stage | Next action |
|---|---|---|---|
| **Ryan James** | Signing up, needs chasing | No confident profile match | Chase. Confirm whether an account was ever created |

### Priority 4 — thinking about signing up

| DJ | Historical | Next action |
|---|---|---|
| **Toby** | Thinking about it | Follow up |
| **Adam Turner** | Thinking about it | Follow up |

### Priority 5 — warm follow-up

| DJ | Historical | Next action |
|---|---|---|
| **Michael Mukasa** | Liked the message | Follow up on a warm signal |
| **Megz** | Liked the message | Follow up on a warm signal |

### Priority 6 — cold, no status

Shaun Pearcey · Bradley Jennings · Shiv Varma · DJ Flex · Jon Blower ·
Adam Hassan · Justin Bradford · Badja · James Kyberd · Ellis Tilson

No status recorded and no confident profile match for any of them.
Next action: first or renewed contact.

### Unmatched database profiles — flagged, not guessed

Seven profiles exist that cannot be confidently matched to any name above.
One of them may be **Tarz** or **Ryan James**; the slugs give no basis to
decide, so they are left unassigned.

> **These are now the New signups inbox at `/admin` → Contacts**, and that
> is where they are worked. Six of them appear there (the seventh,
> `elliot`, is an internal account and is excluded); each can be turned
> into a contact or linked to a prospect already in the CRM, with explicit
> confirmation and no guessing. The table below is the evidence that
> produced the question, not the place to answer it.

| Slug | Product stage | Note |
|---|---|---|
| `roxanemetzjyha` | Onboarding incomplete, **Stripe connected** | Furthest along of the unmatched. Worth identifying |
| `djbenphillipsmusic` | *(matched to Ben Phillips above)* | — |
| `bookings` | No name, no Stripe | Oldest stalled signup, 420h |
| `smithgraeme91` | *(matched to Sol above)* | — |
| `minuet-faxes2m` | No name, no Stripe | Auto-generated slug |
| `values-81-idiom` | No name, no Stripe | Auto-generated slug |
| `philbrewerton868` | No name, no Stripe | No matching name in the outreach list |
| `jojo-metayer` | No name, no Stripe | Newest signup, never returned |
| `elliot` | No name, no Stripe | Possibly a duplicate of Elliot's own account |

**Confident matches made:** Tommy Cleary, Sweenz, Cammy Birse, Steve / SG
Sounds, Ben Phillips, Sizzla, Sol / Graeme Smith — 7 of the 8 historically
signed up. Each was matched on the slug containing the person's name.

---

## 3a. How the operating model works now

Documented here because the growth strategy depends on it: the reason
this file no longer tracks people is that the Admin tracks them better.

**Four things, kept apart.** They can all be true about the same person at
once, and the interface says so rather than collapsing them into one
status.

| | Question it answers | Where it lives |
|---|---|---|
| **Tasks** | What do I need to do? | `crm_tasks`, Tasks destination |
| **Relationship state** | What is currently true? | `outreach_status`, `activation_blocker` |
| **Activity** | What happened? | `crm_notes` plus completed tasks |
| **Playing Next lifecycle** | What does the product know? | Derived, never stored |

**Contacts is a grouped directory.** It opens on the shape of the CRM —
every group and its count on one screen, nothing expanded — and each group
is a lifecycle stage read straight off the resolver. Every person appears
in exactly one group.

**New signups is an inbox, not a stage.** It holds Playing Next accounts
that exist in the product but have not been reconciled with a CRM contact
— people who signed up without anyone writing anything about them. It is
meant to be worked down to zero. A signup leaves it when it is either
turned into a new contact or linked to a prospect already in the CRM, and
from that moment it appears in whichever lifecycle group the product says
it belongs to. Internal accounts are excluded, so the queue can actually
reach zero.

**Linking is always explicit.** From the account, "Link to existing
prospect" searches only contacts with no account yet; from the prospect,
"Link to a DJ account" searches only accounts nobody has claimed. Both run
the same operation, which attaches `dj_profile_id` and writes nothing else
— notes, tasks, blocker and relationship fields survive because it never
goes near them. **There is no fuzzy matching anywhere:** no name
similarity, no email comparison, no scoring, no suggestion. Identity is a
claim a person makes deliberately, and the confirmation names both sides
before it is written. The `roxanemetzjyha` and Tarz questions in §3 are
exactly the kind of thing this exists to resolve, and they now sit in a
queue rather than in a memory.

**Nothing writes lifecycle by hand.** Onboarding, payments readiness,
activation, repeat use and Pro all come from `dj_profiles` and
`song_requests` through one resolver. The Admin refreshes when you return
to it rather than polling.

---

## 4. Acquisition channels

| Channel | Status | Notes |
|---|---|---|
| Direct DJ outreach | Active, unrecorded | The presumed source of most of the 13 |
| Referrals / word of mouth | Unknown | Not tracked |
| Organic Instagram | Not started | Bio and positioning still to do |
| LinkedIn | Not started | Company page, tagline, Elliot's title |
| QR / venue exposure | **Capability built, never exercised** | Display Screen and print formats ship; no external DJ has run a gig |
| Google Ads | Future / test | Blocked on measurement, ROADMAP §6 |
| Meta Ads | Future / test | Same |

**No source is currently attributable.** `dj_profiles` has no utm, source,
campaign or referrer column, so even a DJ who arrives from a known campaign
lands indistinguishable from any other.

---

## 5. Funnel metrics

> **Snapshot, 2026-08-28**, with denominators corrected on 2026-08-30
> after the third internal account was identified. Not maintained —
> `/admin` → Overview and Reports carry these live.

Now that a prospect list exists, several of these become real. Numbers are
counted from §3 and the database. **Nothing here is fabricated; blanks stay
blank.**

| Metric | Measurable? | Current |
|---|---|---|
| Total prospects | **Yes** | **23** |
| Prospects contacted | Partial | At least 13 have a recorded status |
| Response rate | Partial | 2 warm (liked), 2 thinking, 1 signing up |
| Interested rate | Partial | 5 of 23 showed interest short of signing up |
| Signup rate | **Yes** | **8 of 23** historically signed up |
| Onboarding completion | **Yes** | **4 of 13** external profiles |
| Payments ready | **Yes** | **4 of 13** external profiles |
| **Activation rate** | **Yes** | **0 of 13 external** |
| First-gig rate | **Yes** | 0 external |
| Repeat-gig rate | Yes, once any exist | 0 |
| Free to Pro conversion | **Yes** | 0 external |
| Acquisition source | **No** | No source recorded, and no column to hold one |

The funnel collapses at one step. Contact to signup works. **Signup to
first use has a 0% pass rate**, and that is the only number worth moving
right now.

---

## 6. Paid acquisition readiness

> **Re-verified against the codebase 2026-08-30. Every gap below is still
> open** and none of the CRM work touched any of it. This section is
> current, not a snapshot.

**Already present:** GTM, GA4 (verified live), Microsoft Clarity, the
consent mechanism.

**Still required before meaningful paid spend:**

| Requirement | State |
|---|---|
| Advertising consent option | **Missing — hard blocker.** `ads: false` hardcoded in `ConsentBanner.tsx:45,53` |
| Business conversion events | **Missing.** The only `dataLayer.push` calls are GTM's own bootstrap and the consent update; no business event anywhere |
| UTM / click-ID attribution | **Missing.** No capture anywhere |
| Acquisition-source persistence | **Missing.** No column on `dj_profiles` |
| Google Ads conversion setup | **Missing.** No `AW-` tag |
| Meta Pixel | **Missing.** No `fbq` |
| Privacy / cookie wording for ads | **Missing.** Policy covers analytics only |

Roughly a day of engineering for the middle five, plus decisions on consent
and policy wording.

**Behavioural analytics existing is not the same as growth measurement
existing.** We can see what people do after they arrive and nothing about
where they came from.

---

## 7. Experiments

| Experiment | Hypothesis | Audience | Channel | Success metric | Status | Result | Learning |
|---|---|---|---|---|---|---|---|
| *(none yet)* | | | | | | | |

Candidates once the foundations are ready: a Google Ads test, a Meta Ads
test, signup versus landing page, outreach message variants, creative
variants. **The first experiment should probably not be paid at all** —
reactivating the four fully-set-up DJs is cheaper and answers a more
important question.

---

## 8. Growth decisions and learnings

Dated, so we stop revisiting settled questions.

**2026-08-28 — the first known activation blocker is a venue, not the
product.** Cammy Birse asked a club for permission to use Playing Next at
one of his sets and the club's management refused. He is the only DJ so far
who has actually tried to use it, and the thing that stopped him was
outside the product entirely: not setup, not pricing, not the app, but who
controls what happens in the room.

That is worth holding lightly until more DJs report back, because one case
is not a pattern. But if venue permission turns out to be common it changes
more than the pitch. It would mean a resident DJ cannot unilaterally adopt
Playing Next, which affects where activation effort should go (mobile,
private and wedding work versus club residencies), gives the parked
venue/promoter B2B workstream a concrete reason to exist, and suggests the
product may eventually need something a DJ can put in front of a manager.
**Do not act on a sample of one — ask the other four whether they need
permission before recording it as a pattern.**

**2026-08-28 — the funnel breaks at first use, not at acquisition.**
Reconciling Elliot's outreach list against the database: 23 prospects, 8
signed up, 4 fully payments-ready, **0 who have ever taken a request**.
Outreach is working. Four DJs finished every technical step and then never
used the product at a gig, which points at something between "account
ready" and "night in a booth" rather than at the top of the funnel.

**2026-08-28 — the constraint is activation, not acquisition.** 14 external
signups, 6 onboarded, 8 Stripe-connected, **0 who have ever taken a
request**. 10 never set a DJ name. Spending on ads now would buy more
signups into a funnel whose next step has a 0% pass rate.

> *Figures as counted that day and left as written. Re-measured
> 2026-08-30 with the third internal account excluded: **13** external, 4
> onboarded, 6 Stripe-connected, 8 without a DJ name, still **0**
> activated. The conclusion is unchanged and the correction is recorded
> rather than the sentence rewritten.*

**2026-08-28 — advertising measurement is impossible today.** Ad consent is
hardcoded off in both branches of the banner, and the returning-visitor
restore hardcodes all three ad signals denied. Installing tags without
fixing this would produce tags that never fire.

**2026-08-15 — the real USP is the business model, not the feature list.**
Competitor research found PlayThatNext's free plan cannot accept money at
all; tipping is gated behind $19.99/month. Playing Next's free plan charges
for requests immediately at 15%, dropping to 0% on Pro. Position on *"earn
from your first guest, no subscription wall."* The one feature gap found was
guest queue voting.

**2026-08-15 — a network request succeeding is not the same as the tag
working.** The GA4 outage looked like ad-blocking; it was GTM's Google Tag
sending its automatic pageview once at init with consent still denied. A
204 response proved delivery, not correctness.

### Still to learn

- What messaging gets DJs interested
- What objections DJs raise repeatedly
- Which sources produce DJs who actually use the product
- **What stops a signed-up DJ reaching their first gig** — the most
  valuable open question in this file
- Why DJs do or do not upgrade to Pro
