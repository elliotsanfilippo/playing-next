# Playing Next — Roadmap to Launch

Working checklist from here to public launch. Check items off as they land;
keep this file up to date rather than tracking progress anywhere else.

---

## 1. 💰 Finish the financial architecture — CURRENT

This is where we are now, and our immediate priority.

- [x] 50p Guest Service Fee decided
- [x] Free plan = 15% platform fee
- [x] Pro = £14.99/month / 0% platform fee
- [x] Financial columns added to `song_requests`
- [x] `src/lib/pricing.ts` created
- [x] Replace/finalise the secure Stripe checkout route
- [x] Verify £5 request → guest authorises £5.50
- [ ] Verify £8 request → guest authorises £8.50
- [x] Verify Supabase stores `request_amount`, `platform_fee`, `dj_earnings`, etc.
- [x] Make Stripe Connect actually split the money correctly
- [x] Ensure 50p remains with Playing Next
- [x] Ensure Free plan 15% remains with Playing Next
- [x] Ensure correct DJ amount is transferred
- [ ] Capture on acceptance / cancel on decline — logic exists and transfer
      is wired to fire on capture, but not yet tested end-to-end with a
      real completed payment
- [ ] Record actual Stripe processing fees
- [ ] Calculate Playing Next's actual net revenue
- [ ] Test refunds, failed payments and cancellations

## 2. 💳 Pro subscriptions

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

## 3. 📊 DJ earnings & finance dashboard

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

## 4. 🔔 Notifications

A working DJ shouldn't have to stare at Playing Next.

- [ ] New request notification
- [ ] New Song + Message notification
- [ ] Browser/mobile notification approach
- [ ] Sound/vibration where appropriate
- [ ] Notification preferences

## 6. 📱 Mobile QA & UX

This is launch-critical, particularly for guests.

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

## 7. ⚖️ Legal & compliance

This has now moved firmly into the before-launch category. We need:

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

## 8. 🔐 Security & production readiness

Before strangers and real money are involved:

- [ ] Review Supabase RLS on every table
- [ ] Ensure service-role key is server-only
- [ ] Ensure Stripe secret is server-only
- [ ] Stop trusting client-supplied monetary values
- [ ] Validate all API inputs
- [ ] Protect DJ-only API endpoints
- [x] Stripe webhook signature verification — also handles abandoned/expired
      checkouts, Stripe's automatic 7-day uncaptured-auth expiry, and
      keeps `stripe_connected` in sync reactively
  - [ ] Still needs a real endpoint registered with Stripe (CLI for local
        dev via `stripe listen`, Dashboard for production) and a real
        `STRIPE_WEBHOOK_SECRET` set — nothing is listening for live
        events yet, only the route code itself is built and tested
- [x] Prevent duplicate checkout/capture
- [ ] Rate-limit sensitive endpoints
- [ ] Error monitoring
- [ ] Production logging
- [ ] Database backups/recovery plan
- [ ] Environment separation for Stripe test/live
- [ ] Review `.gitignore` and GitHub for leaked secrets

> This is one area where I wouldn't compromise.

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
