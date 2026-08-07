# Pre-Launch Registrations & Costs

Every registration, subscription upgrade, or one-off payment identified
so far that needs your own action before public launch. Nothing here has
been done yet — these all need your own accounts, ID, or card, so
they're yours to complete, not something that can be done from inside
this project. Pulled together from the legal and security work in
[ROADMAP.md](ROADMAP.md); update this list if something new comes up.

Total if you do everything below at the cheap end (sole trader, no
trademark filing): roughly **£50–£150** one-off plus **~£50–£90/year**
ongoing. Incorporating and filing a trademark pushes the one-off total
closer to **£350–£450**.

---

## Do regardless of company structure

- [ ] **ICO data protection fee** — required, not optional: we process
      personal data electronically and don't qualify for any exemption.
      **Tier 1 (micro): £52/year, £47 if you pay by direct debit.**
      Run the free self-assessment tool, then register, at
      [ico.org.uk/for-organisations/data-protection-fee](https://ico.org.uk/for-organisations/data-protection-fee/).
      Can be done now as a sole trader — you can update the registered
      name later if you incorporate.
- [ ] **Domain name** — the site currently only has a
      `playing-next.vercel.app` address. You need a real domain both for
      credibility and so the `[support email — TBD]` placeholders across
      the legal pages and footer can become a real address.
      ~£10–£20/year depending on registrar and TLD.
- [ ] **Business/support email** — once you have a domain, set up
      `support@yourdomain` (or similar). Free with most domain
      registrars if you just want forwarding to an existing inbox; a
      proper hosted mailbox (Google Workspace, etc.) is more like
      £5–£7/month per user if you want it to look and behave fully
      professional.
- [ ] **Supabase Pro upgrade** — needed for real backups / Point-in-Time
      Recovery (see [ROADMAP.md](ROADMAP.md) §2); you already chose to
      defer this to closer to launch. Check current Supabase pricing
      when you do it, since tiers change.

## Depends on the company-structure decision (still deferred)

- [ ] **If staying a sole trader**: register as self-employed with HMRC
      — free, but must be done by 5 October following the end of the tax
      year you started trading, or you risk a penalty.
- [ ] **If incorporating as a Ltd company**: register with Companies
      House — **£100 for standard online incorporation** (this rose from
      £50 in February 2026), plus an ongoing **£50/year confirmation
      statement** filing. You'll need a company name — worth locking in
      once the trademark question below is settled, so they don't
      conflict.
- [ ] **Business bank account** — separate from your personal account,
      regardless of which structure you pick, so guest/DJ money isn't
      mixed with your own. Several UK options (Starling, Tide, Monzo
      Business) have free tiers for a small business.

## Needs professional advice first (the advice itself may cost something)

- [ ] **Payments-regulation / Stripe Connect legal review** — the single
      biggest open legal risk flagged in ROADMAP.md: confirming whether
      Playing Next needs its own FCA registration/authorisation, or is
      properly exempt given how Stripe Connect is structured. This needs
      a solicitor who knows UK payments regulation, not a generic one —
      get this before you scale up real transaction volume.
- [ ] **VAT/accounting advice** — registration is only mandatory once
      your rolling 12-month taxable turnover crosses **£90,000** (you
      then have 30 days to register), but get an accountant's input
      early since Stripe fees and the platform's 15% cut make the
      bookkeeping non-trivial before you're anywhere near that
      threshold.
- [ ] **Trademark registration** (optional, not required to launch) —
      the UK IPO search came back clear for "Playing Next," but nothing
      is legally reserved until you actually file. If you want the name
      protected: a UK trademark application is **£205 for the first
      class online, +£60 per additional class** (current 2026 IPO
      rates), with a **£245 renewal fee** later. Best done after the
      payments legal review above and once your trading name is locked
      in, via [gov.uk/apply-trade-mark-register](https://www.gov.uk/apply-trade-mark-register).

## Not on your bill (flagging so it isn't double-counted)

- **Music licensing (PRS for Music / PPL)** — per your own Guest and DJ
  Terms, this is the DJ's or venue's responsibility, not Playing Next's.
  Nothing to register or pay here on the platform's side.

---

Sources for the figures above: [ICO data protection fee](https://ico.org.uk/for-organisations/data-protection-fee/), [VAT registration threshold](https://www.gov.uk/vat-registration), Companies House 2026 fee changes, and current UK IPO trade mark fees — all checked August 2026; re-verify before paying anything, since government fees change.
