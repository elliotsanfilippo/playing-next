# Data & Vendor Audit

Factual reference for legal/compliance work — what personal data this app
actually collects, where it goes, and how long it's kept. No legal
conclusions here; this is the input your lawyer/accountant needs, not a
substitute for their advice.

Compiled by reading the actual code and schema, not from memory — see
each section for how it was verified.

---

## 1. Data collected from guests (customers)

Guests never create an account — there's no name/email field anywhere in
our own signup flow for them. But personal data still flows through two
paths:

**Stored in our own Supabase database** (`song_requests` table):
- Song title, artist (not personal data about the guest, but reveals a
  taste/preference at a point in time)
- An optional free-text message, if they choose "Song + Message" — this
  can contain anything the guest types, including their own name or other
  personal details if they include it
- No IP address, device ID, or other identifier is stored in this table

**Tracked client-side only** (never sent to our server as such):
- `localStorage` on the guest's own device stores a list of their request
  IDs (`myRequestIds_<djSlug>`), scoped per DJ, so the "My Requests" page
  can show their own history. This is just a list of UUIDs — not personal
  data by itself, but it is a persistent per-device identifier.

**Collected by Stripe, not us** (confirmed by reading the actual Stripe
Checkout screen during testing this session):
- **Email address** — Stripe Checkout requires this by default; we never
  configured it otherwise, so it's mandatory on every payment
- **Cardholder name** — collected via the Stripe card element
- **Card details** — go directly to Stripe, tokenized; never touch our
  servers or database at all
- Whatever else Stripe's fraud/risk tooling collects automatically (IP,
  device fingerprint) — standard Stripe behavior, not something we
  configured or can see directly

**Implicitly logged by infrastructure** (not something we chose to
collect, just how the hosting/tooling works):
- Vercel logs request IP addresses as part of normal server operation
- Our own rate-limiter (`src/lib/rateLimit.ts`) reads the request IP to
  enforce per-IP limits, but only holds it in memory (per server
  instance, cleared on restart/redeploy) — never written to a database
- Sentry (once fully activated) may capture IP address and browser
  details as part of default error context — see the Sentry section below

## 2. Data collected from DJs

DJs do create an account, so this is a larger set:

**In Supabase Auth**: email, hashed password, account creation date —
standard Supabase Auth fields, not something our own code touches
directly.

**In our `dj_profiles` table**:
- DJ name, slug, bio, genres — all self-entered, publicly displayed by
  design (this is the point of a public DJ profile)
- Profile image — uploaded to Supabase Storage, publicly accessible URL
- `stripe_account_id` — a reference ID, not the underlying data itself
- Pricing fields (`request_price`, `shoutout_price`) — business data,
  not personal

**Collected by Stripe Connect, not us** — during onboarding, Stripe's
own hosted flow collects real identity/KYC data that we never see or
store: legal name, date of birth, address, bank account details, and
whatever identity verification Stripe requires for their account type.
This is a significant, sensitive data flow that exists entirely outside
our database.

## 3. Third-party processors

Everyone who receives or processes any of the data above:

| Vendor | What they receive | Purpose |
|---|---|---|
| **Supabase** | DJ account data, all `song_requests` rows (incl. guest messages), profile images | Database, auth, file storage |
| **Stripe** | Guest email + payment details; DJ identity/KYC + bank details | Payment processing, Connect payouts |
| **Spotify** | Search query text only (song/artist names guests type) — no guest identity, we use client-credentials auth, not user-linked Spotify accounts | Track search |
| **Sentry** | Error details, stack traces, request context (IP/browser, by default) | Error monitoring |
| **Vercel** | All request traffic, access logs (incl. IPs), environment secrets | Hosting |

**Not yet confirmed**: Supabase and Vercel's actual data-residency region
for this project — worth checking your Supabase project settings and
Vercel project region, since this affects UK GDPR international-transfer
assessment.

## 4. Cookies

Confirmed by grepping the codebase: **we don't set any cookies
ourselves**. Supabase's JS client defaults to `localStorage` for session
persistence (also confirmed in code — no custom auth storage config), not
cookies.

The one caveat: guests are redirected to `checkout.stripe.com` to pay,
which is Stripe's own hosted page and sets Stripe's own cookies — that's
Stripe's disclosure responsibility, not something in our own cookie
footprint, but your Privacy Policy should probably still mention that
guests leave our site to a third-party payment page.

## 5. Retention — the real gap

There is currently **no data retention or automatic deletion policy** of
any kind. Specifically:

- `song_requests` rows (including guest messages) persist forever —
  there's a `dj_hidden` flag DJs can set to hide old entries from their
  own view, but this doesn't delete anything, it's purely cosmetic
- There's no way for a guest to request deletion of their own data
  through the product — clearing `localStorage` only removes their own
  device's ability to *find* their past requests via "My Requests"; the
  underlying database row is untouched
- DJ accounts and profiles similarly have no deletion/export flow

This is worth flagging to whoever handles your GDPR review specifically —
data minimization and the right to erasure are both UK GDPR requirements,
and right now there's no mechanism for either.

## 6. What guests can and cannot do

**Updated 2026-09-03.** Access and export are now built, admin-mediated.
A guest emails `info@`, ownership is verified by one of three methods,
and they receive a PDF and a JSON file covering the records we could
verify as theirs. Erasure has been available on the same workflow since
31 August, though execution remains disabled pending backups.

What a guest still cannot do **through the product itself** is see or
export anything without contacting us: there is no self-service surface,
no guest login, and no public endpoint. That is deliberate. Their only
cross-device tool remains knowing which DJ they requested from;
everything else relies on the browser they used at the time.

**One limit that cannot be engineered away.** No identifier links a
guest's records: no account, no stored email, and each
`myRequestIds_<djSlug>` list is per-device *and* per-DJ. So an export
covers the records whose ownership was actually verified, and says so.
An export claiming to be everything we hold would be claiming a
completeness the data model cannot support.

## 6a. Privacy-request audit tables

Two tables record that requests were handled. Both are pseudonymous
personal data by way of the row ids they point at, and both belong in
this inventory for that reason.

| Table | Records | Never contains |
|---|---|---|
| `data_erasures` | which fields were cleared on which row | field values, guest identifiers |
| `data_access_requests` | that a request arrived, how ownership was verified, which kinds of record were covered, whether an export was produced | guest email, guest name, message text, the exported payload, and any row id at all on a refusal |

`data_access_requests` carries three timestamps that mean different
things: `received_at` (when the request entered our process, and the
statutory clock), `performed_at` (when we acted) and `performed_by`.
Both tables are append-only, with UPDATE and DELETE revoked explicitly
rather than merely omitted from the GRANT.

**Neither has a retention period yet.** That is an open decision, not an
oversight, and no duration has been invented for either.
