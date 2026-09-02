-- ============================================================
-- When the DJ finished their profile
--
-- NOT APPLIED TO PRODUCTION. Written 2026-09-02, verified against
-- Playing Next Test first.
--
-- The gap this fills
-- ------------------
-- dj_profiles can say WHETHER a profile is finished, by reading four
-- fields. It has never been able to say WHEN. onboarded_at is not the
-- answer: onboarding_complete requires stripe_connected as well, so it
-- marks the moment the DJ became Ready to activate, not the moment they
-- finished their profile. For a DJ who writes their name and uploads a
-- photo in September and connects Stripe in November, those are two
-- different events two months apart, and the CRM timeline currently
-- shows only the second.
--
-- It is also the step most of the stalled DJs are missing, which makes
-- it the most interesting one in the recovery funnel.
--
-- One definition, not a third copy
-- --------------------------------
-- Profile completeness is already defined in TypeScript, in
-- src/lib/recoveryEligibility.ts. Writing the same rule inline in a
-- trigger would create a second definition that can drift, which is
-- exactly how four hand-written copies of the Pro entitlement rule
-- drifted before is_pro_entitled was introduced.
--
-- So this follows that precedent exactly: one SQL function that is the
-- single SQL definition, called rather than restated, and kept in
-- parity with the TypeScript by a test
-- (scripts/profile-complete-parity.test.mts) rather than by hope.
--
-- Known remaining duplication, recorded rather than hidden:
-- app/dj/dashboard/page.tsx still computes its own version inline.
-- Migrating it belongs with the next piece of dashboard work.
-- ============================================================

/*
 * Mirrors profileComplete() in src/lib/recoveryEligibility.ts.
 *
 * The empty-string handling is not incidental. The TypeScript uses
 * Boolean(), which is false for "", so a profile with an empty name or
 * an empty image URL is incomplete there. "is not null" alone would
 * disagree with that, and the parity test would catch it, but it is
 * clearer to write what is meant.
 */
create or replace function public.is_profile_complete(
  p_dj_name text,
  p_request_price integer,
  p_profile_image_url text,
  p_slug text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_dj_name, '') <> ''
     and p_dj_name is distinct from 'New DJ'
     and coalesce(p_request_price, 0) > 0
     and coalesce(p_profile_image_url, '') <> ''
     and coalesce(p_slug, '') <> '';
$$;

comment on function public.is_profile_complete(text, integer, text, text) is
  'The single SQL definition of a finished DJ profile: name set and not '
  'the New DJ placeholder, a price above zero, a photo, and a slug. '
  'Deliberately excludes Stripe, which is what makes it different from '
  'onboarding_complete. Kept in parity with profileComplete() in '
  'src/lib/recoveryEligibility.ts by scripts/profile-complete-parity.test.mts.';

alter table public.dj_profiles
  add column if not exists profile_completed_at timestamptz;

comment on column public.dj_profiles.profile_completed_at is
  'First time name, price, photo and slug were all present. Write-once, '
  'set by trigger. NULL for DJs whose profile was already complete '
  'before this column existed: that date cannot be proven from any '
  'table and is rendered as "before tracking began" rather than '
  'invented.';

-- ------------------------------------------------------------
-- What happens to profiles that are ALREADY complete
--
-- Nothing, and that is the honest answer.
--
-- Five DJs are profile-complete today. There is no updated_at on this
-- table and no history of when their name or photo arrived, so the date
-- is unrecoverable. Back-dating it to now() would be a lie in the
-- timeline, and back-dating it to created_at would be a different lie.
--
-- They keep NULL. The CRM already renders a known-but-undated event as
-- "before tracking began", which is the same treatment onboarded_at and
-- payments_ready_at get for the same reason. Because the trigger fires
-- on UPDATE, a profile that is already complete and never edited again
-- will keep NULL for ever, which is correct: we genuinely do not know.
--
-- This mirrors 20260830_lifecycle_timestamps.sql, deliberately.
-- ------------------------------------------------------------
create or replace function public.dj_profiles_stamp_profile_completed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_profile_complete(
       new.dj_name, new.request_price, new.profile_image_url, new.slug
     ) then
    /* coalesce, so the FIRST completion is what is recorded. A DJ who
       finishes their profile, clears their photo and adds another keeps
       the original date; the later edit is not a second completion. */
    new.profile_completed_at := coalesce(new.profile_completed_at, now());
  end if;

  return new;
end;
$$;

comment on function public.dj_profiles_stamp_profile_completed() is
  'Stamps profile_completed_at the first time the four profile fields '
  'are all present. Write-once via coalesce.';

/*
 * UPDATE, and only on a genuine TRANSITION into completeness.
 *
 * The second condition is the one that matters, and it was missing from
 * the first version. Without it the trigger stamps the first time it
 * NOTICES a complete profile rather than the first time one BECOMES
 * complete, and those differ for exactly the rows this migration
 * promised not to invent dates for.
 *
 * The five DJs who are already complete keep NULL at migration time, as
 * intended. But the moment any of them edited their name or swapped
 * their photo, the old trigger would have fired and dated their profile
 * completion to that edit: "Profile completed 20 Sep" for somebody who
 * finished it on 15 August. That is the same fabrication the migration
 * exists to avoid, just deferred until somebody touched the row.
 *
 * Requiring OLD to be incomplete fixes it. A row that was already
 * complete can never trigger a stamp, however often it is edited, so it
 * stays honestly unknown. This mirrors the transition checks in
 * 20260830_lifecycle_timestamps.sql, which test the previous value for
 * the same reason.
 *
 * The WHEN clause also matters for cost: dj_profiles is updated
 * constantly by the last_active_at heartbeat, and without the
 * field-change condition this would run on every one of those.
 */
drop trigger if exists dj_profiles_stamp_profile_completed on public.dj_profiles;
create trigger dj_profiles_stamp_profile_completed
  before update on public.dj_profiles
  for each row
  when (
    old.profile_completed_at is null
    and not public.is_profile_complete(
      old.dj_name, old.request_price, old.profile_image_url, old.slug
    )
    and (
      old.dj_name is distinct from new.dj_name
      or old.request_price is distinct from new.request_price
      or old.profile_image_url is distinct from new.profile_image_url
      or old.slug is distinct from new.slug
    )
  )
  execute function public.dj_profiles_stamp_profile_completed();

-- ------------------------------------------------------------
-- And the same rule at INSERT
--
-- 20260830_lifecycle_timestamps.sql anticipated this exactly: "If
-- signup ever creates a row already in one of these states, this needs
-- an INSERT branch - OLD does not exist there, so it cannot simply be
-- added to the same trigger." It needs a second trigger, but not a
-- second function: the body reads only NEW, so both can share it.
--
-- Why this is not the same as inventing a historical date
-- ------------------------------------------------------
-- The five profiles that are already complete get nothing, because they
-- already exist and an INSERT trigger cannot fire for a row that was
-- inserted before it existed. Their completion date is genuinely
-- unrecoverable and stays NULL.
--
-- A row created complete AFTER this ships is a different fact
-- altogether. We are present at the moment it happens, and "this
-- profile was complete when it was created" is something we observed
-- rather than reconstructed. Refusing to record it would lose a date we
-- actually have, which is the opposite failure to the one being avoided.
--
-- Nothing creates such a row today: bootstrap-profile inserts every
-- profile as "New DJ" with no photo, so this branch is dormant. It
-- exists so that the day something does - an admin-created account, an
-- import, a signup flow that collects a name up front - the timeline is
-- right without anybody remembering to come back here.
--
-- The coalesce matters more here than on the UPDATE path. A restore or
-- a migration that re-inserts a row WITH its original
-- profile_completed_at keeps that value; only a row arriving without one
-- is stamped now(). A bulk re-insert that dropped the column would
-- therefore date those rows to the restore, which is worth knowing
-- before anybody attempts one.
-- ------------------------------------------------------------
drop trigger if exists dj_profiles_stamp_profile_completed_insert on public.dj_profiles;
create trigger dj_profiles_stamp_profile_completed_insert
  before insert on public.dj_profiles
  for each row
  when (new.profile_completed_at is null)
  execute function public.dj_profiles_stamp_profile_completed();

/*
 * No grant changes. The column inherits dj_profiles' existing
 * privileges, and anon reads the guest page through
 * public_dj_request_bootstrap, whose select list is written out by
 * hand, so this is not visible to guests. Same reasoning as
 * 20260830_lifecycle_timestamps.sql and 20260901_lifecycle_email_optout.sql,
 * restated rather than assumed.
 */
