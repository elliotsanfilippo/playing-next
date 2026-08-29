# Pre-Launch Registrations & Costs

Every registration, upgrade or one-off payment that needs **Elliot's own
name, ID or card**. These cannot be done from inside the project.

[ROADMAP.md](ROADMAP.md) is authoritative for everything else; this file
is only the list of things to go and buy or register.

Rough total at the cheap end (sole trader, no trademark): **£50–£150
one-off plus ~£50–£90/year**. Incorporating and filing a trademark pushes
the one-off closer to **£350–£450**.

---

## Already done — do not re-buy

- ~~Domain name~~ — `playingnextapp.com` is live and in production, with
  `www` redirecting to the apex.
- ~~Business/support email~~ — in place; the legal pages no longer carry
  `[support email — TBD]` placeholders.
- ~~Stripe test/live environment separation~~ — resolved in code.
  `src/lib/stripeEnvironment.ts` resolves the mode from the key and reads
  `stripe_account_id` or `stripe_test_account_id` accordingly, and refuses
  to guess on a malformed key.
- ~~Cookie consent banner and analytics~~ — GTM, GA4 and Clarity are live
  with Google Consent Mode.

---

## Before any of this matters

These registrations are the cost of opening Playing Next to the public.
**The product is not yet ready to be opened**, and not for technical
reasons: 14 external DJs have signed up and **none has yet taken a single
paid request**. Spending on incorporation, trademarks or advice ahead of
that is spending against an unvalidated funnel.

Sequence suggestion: the ICO fee and a business address are worth doing now
regardless, since they are cheap, required, and block the Privacy Policy.
The rest can reasonably wait until a DJ has actually used Playing Next at a
real gig. See [GROWTH_CRM.md](GROWTH_CRM.md).

---

## Do regardless of company structure

- [ ] **ICO data protection fee** — required, not optional. Tier 1 (micro):
      **£52/year, £47 by direct debit.** Self-assessment and registration at
      [ico.org.uk](https://ico.org.uk/for-organisations/data-protection-fee/).
      Can be done now as a sole trader; the registered name can be updated
      later if you incorporate.
- [ ] **Supabase Pro upgrade** — needed for real backups and
      Point-in-Time Recovery. Deferred by choice to closer to launch. Check
      current pricing when you do it.
- [ ] **Virtual mailbox or business address** — the Privacy Policy still has
      no geographic address, which UK E-Commerce Regulations 2002 require.
      This is the practical blocker on that item.

## Depends on the company-structure decision

- [ ] **If sole trader**: register as self-employed with HMRC. Free, but due
      by 5 October following the end of the tax year you started trading.
- [ ] **If incorporating**: Companies House registration, **£100** online
      plus **£50/year** confirmation statement. Note the Ltd path was
      abandoned mid-registration during the beta over the public
      registered-office record.
- [ ] **Business bank account** — separate from personal, whichever
      structure. Starling, Tide and Monzo Business all have free tiers.

## Needs professional advice first

- [ ] **Payments-regulation / Stripe Connect legal review** — the biggest
      open legal risk. Whether Playing Next needs its own FCA registration
      or is properly exempt given how Connect is structured. Needs a
      solicitor who knows UK payments regulation, not a generalist. Get this
      before scaling real transaction volume.
- [ ] **Solicitor review of the four legal documents** — DJ Terms, Guest
      Terms, Refund Policy and Privacy Policy are all still marked
      "Draft — not yet legally reviewed".
- [ ] **VAT / accounting advice** — registration is mandatory only above
      **£90,000** rolling 12-month turnover, but Stripe fees and the 15% cut
      make the bookkeeping non-trivial long before that.
- [ ] **Trademark registration** (optional) — the UK IPO search came back
      clear for "Playing Next" but nothing is reserved until filed. **£205**
      first class, **+£60** per additional class, **£245** renewal. Best done
      after the payments review and once the trading name is locked.

---

## Real-device QA still outstanding

Not a purchase, but it needs a real phone and a real DJ login, so it sits
with the items only Elliot can do. Covered in [ROADMAP.md](ROADMAP.md) §4
alongside 6A Tier 3 — do them in one session.

Guest keyboard journey: search field visibility, skeleton rows, scrollable
results with the keyboard up, clear button, shoutout textarea, payment CTA
reachability, numeric keypad on the custom tip amount, no zoom on focus
(iOS zooms inputs under 16px), no viewport jump, focus never lost, and every
primary action reachable one-handed.
