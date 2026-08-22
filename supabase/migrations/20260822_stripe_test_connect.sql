-- ============================================================
-- Sandbox Connect accounts
--
-- dj_profiles has one stripe_account_id, and every one of them is a
-- live-mode account. A test-mode key therefore has no account it can pay:
-- a sandbox destination charge aimed at a live acct_ is rejected with
-- "No such destination", which is why the guest happy path cannot be
-- exercised outside production.
--
-- Rather than overwrite a live id (which would be unrecoverable and would
-- break real payouts), the test-mode identifiers get their own columns.
-- Which pair is read is decided by the mode of the running Stripe key —
-- see src/lib/stripeEnvironment.ts. Live code paths never read or write
-- the test columns, and test code paths never read or write the live ones.
--
-- Nullable and additive. No backfill: a DJ has no sandbox account until
-- one is deliberately onboarded in test mode, and NULL is exactly the
-- right way to say "not set up for testing". Existing rows are untouched.
-- ============================================================

alter table public.dj_profiles
  add column if not exists stripe_test_account_id text;

alter table public.dj_profiles
  add column if not exists stripe_test_connected boolean not null default false;

-- One sandbox Connect account belongs to one DJ, same as the live side.
create unique index if not exists dj_profiles_stripe_test_account_id_key
  on public.dj_profiles (stripe_test_account_id)
  where stripe_test_account_id is not null;

comment on column public.dj_profiles.stripe_test_account_id is
  'Stripe Connect account used when running against a test-mode Stripe key. Never used in live mode. NULL means this DJ has no sandbox account and test payments to them will fail cleanly.';

comment on column public.dj_profiles.stripe_test_connected is
  'Whether the test-mode Connect account has completed onboarding (charges + payouts enabled). Mirrors stripe_connected for the live account.';
