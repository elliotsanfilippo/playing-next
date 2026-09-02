-- ============================================================
-- TEST-ONLY FIXTURE SCHEMA — NOT A MIGRATION
--
-- ⚠ This file is NOT part of the Playing Next database definition and
--   must never be applied to Production or copied into
--   supabase/migrations/.
--
-- It exists to give erase_personal_fields something to act on inside a
-- disposable second Supabase Free project. Read
-- test-environment/erasure/README.md before trusting any result from it.
--
-- WHAT THIS IS
-- ------------
-- The minimum source tables the erasure write-path suite touches,
-- derived from the PostgREST/OpenAPI description of Production. That
-- description gives column names, types, NOT NULL, defaults, primary
-- keys and foreign keys, so those are faithful.
--
-- WHAT THIS IS NOT
-- ----------------
-- It does NOT reproduce, and cannot be used to reason about:
--   * CHECK constraints          (not exposed by the description)
--   * Row Level Security         (not exposed)
--   * role grants                (not exposed)
--   * triggers                   (not exposed)
--   * indexes                    (not exposed)
--
-- Production security was verified against Production, read-only, on
-- 2026-08-31. Nothing here supports or weakens that finding; the two are
-- unrelated environments answering unrelated questions.
--
-- Deliberately omitted, because the suite does not need them and adding
-- them would make this look more like a schema copy than it is:
-- chargeback_disputes, push_subscriptions, dj_events, the CRM tables,
-- the public bootstrap view, and every RPC other than the one under
-- test. dj_events is referenced by song_requests.event_id and tips
-- .event_id in Production; that FK is dropped here rather than stubbed,
-- since no test sets it.
--
-- SYNTHETIC DATA ONLY. Never load Production rows into this project.
-- ============================================================

-- ── dj_profiles ──────────────────────────────────────────────────
-- Only the columns the fixtures and the classifier touch. Production
-- has 33; reproducing all of them would imply a completeness this file
-- does not have.
create table if not exists public.dj_profiles (
  id                  uuid primary key default gen_random_uuid(),
  dj_name             text not null,
  slug                text not null,
  request_status      text not null default 'taking_requests',
  onboarding_complete boolean default false,
  stripe_connected    boolean not null default false,
  created_at          timestamptz default now()
);

-- ── song_requests ────────────────────────────────────────────────
-- Every column erase_personal_fields, the classifier or the suite's
-- "nothing else changed" diff relies on. The money columns are present
-- precisely so the suite can prove they are NOT touched.
create table if not exists public.song_requests (
  id                         uuid primary key default gen_random_uuid(),
  dj_profile_id              uuid references public.dj_profiles(id),
  song_title                 text not null,
  artist                     text not null,
  message                    text,
  request_status             text not null default 'pending',
  created_at                 timestamptz default now(),
  stripe_payment_intent_id   text,
  stripe_checkout_session_id text,
  stripe_fee                 integer,
  accepted_at                timestamptz,
  reported_not_played_at     timestamptz,
  request_amount             integer,
  guest_service_fee          integer,
  platform_fee               integer,
  dj_earnings                integer,
  total_amount               integer,
  currency                   text,
  is_vip                     boolean not null default false,
  dj_hidden                  boolean default false
);

-- ── tips ─────────────────────────────────────────────────────────
create table if not exists public.tips (
  id                         uuid primary key default gen_random_uuid(),
  dj_profile_id              uuid not null references public.dj_profiles(id),
  message                    text,
  amount                     integer not null,
  guest_service_fee          integer not null default 0,
  platform_fee               integer not null default 0,
  dj_earnings                integer not null default 0,
  total_amount               integer not null default 0,
  currency                   text not null default 'gbp',
  stripe_fee                 integer,
  stripe_payment_intent_id   text,
  stripe_checkout_session_id text,
  status                     text not null default 'pending',
  created_at                 timestamptz not null default now()
);

-- ── qr_box_orders ────────────────────────────────────────────────
-- The address fields are the point: this is the table whose personal
-- data is a home address, and the one case erasure can refuse on the
-- merits rather than on evidence.
create table if not exists public.qr_box_orders (
  id                       uuid primary key default gen_random_uuid(),
  dj_profile_id            uuid not null references public.dj_profiles(id),
  recipient_name           text,
  address_line1            text,
  address_line2            text,
  city                     text,
  postcode                 text,
  country                  text,
  shipping_amount          integer,
  stripe_payment_intent_id text,
  status                   text not null default 'pending_payment',
  created_at               timestamptz not null default now()
);

-- ============================================================
-- Next: apply these CANONICAL migrations, in order, from
-- supabase/migrations/ — not copies, the real files, so the objects
-- under test are the ones that will run in Production:
--
--   20260819_not_played_reports.sql
--   20260831_data_erasures.sql
--   20260831_data_erasures_revoke.sql
--   20260831_erase_atomically.sql
-- ============================================================

-- ------------------------------------------------------------
-- Added 2026-09-02 so the profile_completed_at migration could be
-- verified here. Both columns exist in Production already; this fixture
-- was inferred from a narrower set of tables and did not carry them.
--
-- Still not a Production schema. This file remains an inferred,
-- incomplete fixture whose only purpose is letting a migration and its
-- triggers be exercised somewhere that is not Production.
-- ------------------------------------------------------------
alter table public.dj_profiles add column if not exists request_price integer;
alter table public.dj_profiles add column if not exists profile_image_url text;
