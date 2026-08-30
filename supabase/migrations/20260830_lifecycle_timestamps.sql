-- ============================================================
-- When each lifecycle state actually happened
--
-- dj_profiles knows WHETHER a DJ finished onboarding, connected
-- payments and became Pro. It has never known WHEN. onboarding_complete
-- and stripe_connected are bare booleans and plan is a bare string, so
-- five of the eight events a CRM timeline wants are derivable from
-- existing timestamps and these three are not.
--
-- Why this is not a second copy of truth
-- --------------------------------------
-- The boolean is the state; the timestamp is the moment it changed.
-- They cannot disagree because they are written in the same statement:
-- a BEFORE UPDATE trigger sets the stamp on the row that is already
-- changing. There is no second writer to forget, no application code
-- that can be bypassed, and the backfill script and any manual SQL edit
-- are covered too.
--
-- Write-once, deliberately
-- ------------------------
-- Every stamp uses coalesce, so it records the FIRST time a DJ reached
-- that state and is never pushed forward. This matters most for
-- payments: account.updated fires repeatedly, and a plain now() would
-- walk payments_ready_at forward on every webhook until the column
-- meant "the last time Stripe mentioned this account".
--
-- pro_since means FIRST EVER Pro-entitled, not the current period
-- ---------------------------------------------------------------
-- Settled deliberately before writing this. The webhook OVERWRITES
-- stripe_subscription_id when a DJ resubscribes, so the original
-- subscription disappears from our record and the first-ever date
-- becomes unrecoverable here. The current period, by contrast, is
-- always one lookup away: stripe_subscription_id is stored and Stripe
-- holds start_date and current_period_start.
--
-- So the column stores the thing that cannot be recovered elsewhere. A
-- DJ who cancels and returns keeps their original pro_since; the return
-- is a separate event, and if it ever matters it belongs in the CRM
-- timeline rather than by overwriting history.
--
-- Existing rows stay NULL. The dates cannot be proven from any table,
-- and the UI renders them as "before tracking began" rather than
-- inventing one.
-- ============================================================

alter table public.dj_profiles
  add column if not exists onboarded_at timestamptz,
  add column if not exists payments_ready_at timestamptz,
  add column if not exists pro_since timestamptz;

comment on column public.dj_profiles.onboarded_at is
  'First time onboarding_complete became true. Write-once, set by '
  'trigger. NULL for DJs who onboarded before this column existed.';

comment on column public.dj_profiles.payments_ready_at is
  'First time stripe_connected became true. Write-once, set by trigger, '
  'so repeated account.updated webhooks cannot push it forward.';

comment on column public.dj_profiles.pro_since is
  'First time the DJ was ever Pro-entitled, not the start of the '
  'current subscription. The current period is recoverable from Stripe '
  'via stripe_subscription_id; the first-ever date is not, because the '
  'webhook overwrites that id on resubscribe.';

-- ------------------------------------------------------------
-- The stamping trigger
-- ------------------------------------------------------------
create or replace function public.dj_profiles_stamp_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  /* "is distinct from true" rather than "= false": the previous value
     may be NULL, and NULL = false is NULL, which would silently skip
     the very first transition. */
  if new.onboarding_complete is true
     and old.onboarding_complete is distinct from true then
    new.onboarded_at := coalesce(new.onboarded_at, now());
  end if;

  if new.stripe_connected is true
     and old.stripe_connected is distinct from true then
    new.payments_ready_at := coalesce(new.payments_ready_at, now());
  end if;

  /*
   * Entitlement, not plan. plan stays 'pro' while a subscription is
   * unpaid or paused, and those are not Pro. The rule is called rather
   * than restated: public.is_pro_entitled is the single SQL definition,
   * kept in parity with src/lib/planEntitlement.ts by
   * scripts/entitlement-parity.test.ts. A fourth copy here is exactly
   * how the four hand-written copies before it drifted.
   */
  if public.is_pro_entitled(new.plan, new.stripe_subscription_status)
     and not public.is_pro_entitled(old.plan, old.stripe_subscription_status)
  then
    new.pro_since := coalesce(new.pro_since, now());
  end if;

  return new;
end;
$$;

comment on function public.dj_profiles_stamp_lifecycle() is
  'Stamps onboarded_at, payments_ready_at and pro_since on the first '
  'transition into each state. Write-once via coalesce.';

/*
 * UPDATE only. Profiles are created un-onboarded, unconnected and free
 * and transition later, so there is no insert to stamp. If signup ever
 * creates a row already in one of these states, this needs an INSERT
 * branch - OLD does not exist there, so it cannot simply be added to
 * the same trigger.
 *
 * The WHEN clause matters for cost, not just tidiness: dj_profiles is
 * updated constantly by the last_active_at heartbeat, and without it
 * this function would execute on every one of those. With it, the
 * trigger body runs only when one of the four columns it cares about
 * actually changes.
 */
drop trigger if exists dj_profiles_stamp_lifecycle on public.dj_profiles;
create trigger dj_profiles_stamp_lifecycle
  before update on public.dj_profiles
  for each row
  when (
    old.onboarding_complete is distinct from new.onboarding_complete
    or old.stripe_connected is distinct from new.stripe_connected
    or old.plan is distinct from new.plan
    or old.stripe_subscription_status is distinct from new.stripe_subscription_status
  )
  execute function public.dj_profiles_stamp_lifecycle();

/*
 * No grant changes. The three columns inherit dj_profiles' existing
 * column-level privileges, which means anon does NOT gain access to
 * them: anon holds SELECT on 12 named columns only, and adding a column
 * grants nobody anything. That column allowlist is the guest page's
 * security boundary and this migration does not widen it.
 */
