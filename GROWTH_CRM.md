# Playing Next — Growth & CRM

The source of truth for early DJ acquisition and beta growth: the
pipeline, the channels, the experiments and what we have learned.

[ROADMAP.md](ROADMAP.md) §6 holds the Growth workstream and its technical
dependencies. This file holds the operational detail. Cross-reference
rather than duplicating.

**Not a CRM system.** A markdown file, deliberately. No HubSpot, no
Salesforce, no integration.

---

## 1. Growth status

*Figures read from Production on 2026-08-28. Update the date when refreshed.*

| | |
|---|---|
| DJ profiles | **16** |
| Of which Elliot's own | 2 (`ELSAN`, `dj-elliot-test`) |
| **External signups** | **14** |
| Completed onboarding | 6 of 16 |
| Connected to Stripe | 8 of 16 |
| **DJs who have ever received a request** | **2 — both Elliot's own** |
| **External DJs who have taken a paid request** | **0** |
| Pro subscribers | 1 (`dj-elliot-test`, Elliot's) |

**Current acquisition stage:** pre-activation. Signups exist; usage does
not.

**Immediate growth objective:** get **one external DJ to take one real paid
request at a real gig.** Not more signups. Until that happens there is no
funnel to widen, and paid acquisition would be buying more of a step that
already fails.

**The headline finding.** 10 of 16 profiles never even set a DJ name — they
are still "New DJ". Signup is not the constraint. Whatever happens between
signing up and standing in a booth is the constraint, and nobody has
crossed it yet.

---

## 2. DJ acquisition funnel

| Stage | Meaning |
|---|---|
| Prospect | Identified, not yet contacted |
| Contacted | Outreach sent, no reply |
| Interested | Replied positively |
| Signing up | Sent to the product, account not yet created |
| Signed up | Account exists |
| Onboarding incomplete | Account exists, `onboarding_complete` false |
| **Activated** | See below — needs your decision |
| Used at first gig | Took requests during a real set |
| Repeat user | Used at more than one gig |
| Pro | On a paid subscription |
| Not interested / lost | Declined or went cold |

### Activation definition — needs your approval

Signup alone is clearly the wrong measure: 14 external DJs are signed up
and none has used the product.

**Proposed:** a DJ is *Activated* when they have

1. completed onboarding (`onboarding_complete`), **and**
2. connected Stripe (`stripe_connected`), **and**
3. **accepted at least one real paid request** (a `song_requests` row
   reaching `accepted`, `playing_next` or `played` with a captured payment)

The third condition is the one that matters. The first two are readiness;
only the third is use. All three are already measurable from existing
columns with no new tracking.

**Flagged for your approval, not adopted.** A looser definition (onboarding
plus Stripe, without a request) would count 6 DJs today instead of 0, which
would feel better and mean less.

---

## 3. Existing DJ outreach

**No outreach history was recoverable.** I searched the repo, all project
documentation, git history and both memory sets. Prospect lists, outreach
messages and contact records were never written down anywhere I can read.
That planning happened outside this project's records.

What follows is reconstructed **from the database only** — it is signup
evidence, not contact history. Every row therefore starts as
**Needs follow-up**: the last known status is a database fact, not a
conversation, and any assumption about where a DJ actually stands would be
invented.

Sensitive data deliberately excluded: no emails, no auth identifiers.
Names and slugs are already public on the request pages.

| DJ | Stage | Last known status | Last active | Source | Next action | Notes |
|---|---|---|---|---|---|---|
| Tommy Reckless | Signed up | Onboarded, Stripe connected, 0 requests | never | Unknown | Needs follow-up | Fully set up and never used it. Best activation candidate |
| DJ Sweenz | Signed up | Onboarded, Stripe connected, 0 requests | 314h | Unknown | Needs follow-up | Same shape |
| Cammy Birse | Signed up | Onboarded, Stripe connected, 0 requests | 377h | Unknown | Needs follow-up | Same shape |
| SGsounds | Signed up | Onboarded, Stripe connected, 0 requests | 90h | Unknown | Needs follow-up | Most recently active of the ready group |
| djbenphillipsmusic | Onboarding incomplete | Stripe connected, no name set | 287h | Unknown | Needs follow-up | Connected Stripe but never finished |
| roxanemetzjyha | Onboarding incomplete | Stripe connected, no name set | 95h | Unknown | Needs follow-up | Same |
| DJ Sizzla | Onboarding incomplete | Named, no Stripe | 260h | Unknown | Needs follow-up | Set a name, stopped |
| bookings | Onboarding incomplete | No name, no Stripe | 420h | Unknown | Needs follow-up | Oldest stalled signup |
| smithgraeme91 | Onboarding incomplete | No name, no Stripe | 401h | Unknown | Needs follow-up | |
| minuet-faxes2m | Onboarding incomplete | No name, no Stripe | 340h | Unknown | Needs follow-up | |
| values-81-idiom | Onboarding incomplete | No name, no Stripe | 245h | Unknown | Needs follow-up | |
| elliot | Onboarding incomplete | No name, no Stripe | 215h | Unknown | Needs follow-up | Possibly a duplicate of Elliot's own |
| philbrewerton868 | Onboarding incomplete | No name, no Stripe | 122h | Unknown | Needs follow-up | |
| jojo-metayer | Onboarding incomplete | No name, no Stripe | never | Unknown | Needs follow-up | Newest signup, never returned |

**Please correct this table.** Source, real stage and next action are yours
to fill in; I have no way to know them.

**The pattern worth acting on:** four DJs are completely set up — onboarded,
Stripe connected — and have never taken a request. They are the shortest
path to the first external activation.

---

## 4. Acquisition channels

| Channel | Status | Notes |
|---|---|---|
| Direct DJ outreach | Active, unrecorded | The presumed source of most of the 14 |
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

Placeholders. **Do not fabricate numbers that are not measurable.**

| Metric | Measurable today? | Current |
|---|---|---|
| Prospects contacted | No — not recorded | — |
| Response rate | No | — |
| Interested rate | No | — |
| Signup rate | No (no source data) | — |
| Onboarding completion | **Yes** | 6 / 16 |
| Activation rate | **Yes** | **0 / 14 external** |
| First-gig rate | **Yes** | 0 external |
| Repeat-gig rate | Yes, once any exist | 0 |
| Free to Pro conversion | Yes | 0 external |
| Acquisition source | **No** | Needs a column |

Four of ten are measurable now. The rest need either the outreach record in
§3 or the attribution work in ROADMAP §6.

---

## 6. Paid acquisition readiness

**Already present:** GTM, GA4 (verified live), Microsoft Clarity, the
consent mechanism.

**Still required before meaningful paid spend:**

| Requirement | State |
|---|---|
| Advertising consent option | **Missing — hard blocker.** `ads: false` hardcoded in `ConsentBanner.tsx:45,53` |
| Business conversion events | **Missing.** Zero custom dataLayer pushes exist |
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

**2026-08-28 — the constraint is activation, not acquisition.** 14 external
signups, 6 onboarded, 8 Stripe-connected, **0 who have ever taken a
request**. 10 never set a DJ name. Spending on ads now would buy more
signups into a funnel whose next step has a 0% pass rate.

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
