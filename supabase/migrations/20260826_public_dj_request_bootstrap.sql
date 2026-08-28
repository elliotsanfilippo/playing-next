-- ============================================================
-- A deliberately shaped public boundary for the guest request page
--
-- Why this exists
-- ---------------
-- The guest request page renders nothing on the server today. A guest in
-- a venue on weak mobile data waits ~6.3s before the DJ's name appears,
-- and ~5.5s of that is downloading, parsing and hydrating JavaScript
-- purely so the browser can run a Supabase query. Server-rendering the
-- identity removes that wait.
--
-- The obvious way to do that would be a service-role query on the server
-- with a hand-written column list. We are deliberately not doing that.
-- On 2026-09-03 a column added to the guest page's select string took
-- every DJ's request page down, and the thing that caught it was
-- Postgres: anon has no table-level SELECT on dj_profiles, only grants
-- on 12 named columns, so the query failed closed with 42501 rather than
-- leaking plan and stripe_subscription_status. Moving the allowlist into
-- a TypeScript string would throw that protection away and reintroduce
-- exactly the failure mode that caused the outage.
--
-- So the public shape stays in the database. This view is the entire
-- public surface of the request page, its column list is the security
-- boundary, and a new column on dj_profiles is private until somebody
-- edits this file.
--
-- Security mode
-- -------------
-- security_invoker = false is REQUIRED and is not incidental. The view
-- must read plan and stripe_subscription_status to decide whether a Pro
-- DJ's event pricing is actually in force, and anon cannot read either
-- column. Running as the view owner lets it evaluate that internally and
-- publish only the result.
--
-- The consequence must be stated plainly: because the view runs as its
-- owner, it bypasses the caller's column privileges and any RLS on
-- dj_profiles. Nothing about the caller restricts it. THE SELECT LIST
-- BELOW IS THEREFORE THE COMPLETE PUBLIC SECURITY BOUNDARY FOR THIS
-- SURFACE. There is no second line of defence underneath it. Anything
-- added to it is public the moment this runs.
--
-- Verified before writing this, against the live database:
--   * dj_profiles has 30 columns; anon holds SELECT on exactly 12 of
--     them and `select=*` as anon returns 42501.
--   * anon already sees all 15 dj_profiles rows, the same set the
--     service role sees, so RLS is not currently filtering rows for
--     anon on this table. The column grants are the whole protection,
--     which is precisely why this view does not widen them.
--   * dj_events has 8 columns and all 8 are already readable by anon,
--     so the event fields below expose nothing new.
--
-- What this migration does NOT do
-- -------------------------------
--   * It does not alter a single grant on dj_profiles or dj_events.
--   * It does not enable, disable or modify RLS anywhere.
--   * It grants SELECT on one new view, whose columns are all either
--     already public or a derived boolean.
-- ============================================================

-- ------------------------------------------------------------
-- The entitlement rule, in SQL
--
-- This is a second implementation of src/lib/planEntitlement.ts's
-- isProEntitled(), and that duplication is a known cost accepted for a
-- specific reason: the rule has to run inside the view, and the view has
-- to be in the database for the boundary to be enforced by Postgres.
--
-- It is isolated into its own function rather than inlined into the view
-- so that there is exactly one SQL copy of the policy, and so a test can
-- call it directly with every status TypeScript knows about.
--
-- scripts/entitlement-parity.test.ts enumerates ENTITLED_STATUSES and
-- UNENTITLED_STATUSES from the TypeScript module and asserts this
-- function agrees on every one. Changing the policy on either side
-- without the other fails that test. Keep them together.
-- ------------------------------------------------------------
create or replace function public.is_pro_entitled(
  p_plan   text,
  p_status text
) returns boolean
language sql
immutable
set search_path = ''
as $$
  /* The null guards are not decoration. `p_plan = 'pro'` yields NULL
     rather than false when p_plan is null, and isProEntitled() returns a
     strict boolean, so without these the two implementations disagree on
     a null plan. The view happens to be unaffected because a NULL in a
     WHERE clause is already falsy, but a function that returns NULL
     where TypeScript returns false is exactly the kind of quiet mismatch
     the parity test exists to catch — and did catch. */
  select p_plan is not null
     and p_plan = 'pro'
     and p_status is not null
     and p_status in ('active', 'trialing', 'past_due');
$$;

comment on function public.is_pro_entitled(text, text) is
  'Pro entitlement policy. Mirrors isProEntitled() in '
  'src/lib/planEntitlement.ts; scripts/entitlement-parity.test.ts '
  'asserts the two agree. Update both together.';

-- ------------------------------------------------------------
-- EXECUTE grants, and why anon genuinely needs one
--
-- Read this before "tidying up" these grants. Revoking EXECUTE from
-- anon here takes the guest request page down, and it has already done
-- so once, on 2026-08-28.
--
-- The reasoning that caused it was: the bootstrap view is
-- security_invoker = false, so it runs as its owner, so the caller needs
-- no privileges of its own. That is true of the TABLES the view reads.
-- It is not true of the FUNCTIONS it calls. A plain LANGUAGE SQL
-- function invoked inside a view still executes with the CALLER's
-- privileges, so anon selecting from public_dj_request_bootstrap must be
-- able to execute this function or the whole query fails with 42501.
--
-- Granting it exposes nothing: this function takes a plan and a status
-- as arguments and returns a boolean. It reads no rows and no columns,
-- so a caller can only ever learn the answer for values it already
-- supplied. plan and stripe_subscription_status remain unreadable.
--
-- If this ever does need to be locked down, the way to do it is to make
-- the function SECURITY DEFINER so the caller's privileges stop
-- mattering — not to revoke the grant and leave the view broken.
-- ------------------------------------------------------------
revoke all on function public.is_pro_entitled(text, text) from public;
grant execute on function public.is_pro_entitled(text, text)
  to anon, authenticated, service_role;

-- ------------------------------------------------------------
-- The public bootstrap view
--
-- Every column is listed by hand. There is no select *, no
-- p.*, and no room for a future column to arrive by accident.
--
-- Deliberately absent, though anon can already read it on the base
-- table: hidden_from_discovery, a Find Your DJ listing flag that has no
-- meaning on a page reached by direct URL or QR.
--
-- bio is present, and the distinction matters. This view has to be a
-- complete replacement for the guest page's base-table read, because the
-- point of the exercise is that anon's direct SELECT on dj_events can
-- then be revoked; leaving bio out would strand the header's disclosure
-- and force the client to keep reading dj_profiles directly.
--
-- Exposing it here does NOT mean shipping it in the first paint. The
-- server bootstrap DTO selects has_bio and not bio, so the biography
-- never enters the serialized HTML; the client's reconciliation fetch
-- asks for bio explicitly once it is running. Same view, two different
-- column selections, chosen per caller.
--
-- Deliberately absent and private: plan, stripe_subscription_status,
-- stripe_account_id, stripe_test_account_id, stripe_customer_id,
-- stripe_subscription_id, stripe_connected, stripe_test_connected,
-- user_id, max_pending_requests, max_queue_requests, and every other
-- column on dj_profiles.
-- ------------------------------------------------------------
create or replace view public.public_dj_request_bootstrap
with (security_invoker = false)
as
select
  -- identity
  p.id,
  p.slug,                       -- the lookup key the request page filters on
  p.dj_name,
  p.profile_image_url,
  p.genres,

  -- has_bio lets the server render the header's disclosure affordance
  -- correctly without putting the biography in the first paint. bio
  -- itself is here so the client's reconciliation fetch has somewhere to
  -- read it from other than the base table. The server DTO selects the
  -- boolean; the client selects the text.
  (p.bio is not null and length(btrim(p.bio)) > 0) as has_bio,
  p.bio,

  -- Raw availability inputs, not a verdict.
  --
  -- availabilityReason() depends on Date.now(): auto_close_at may pass
  -- and last_active_at ages out after ACTIVITY_TIMEOUT_HOURS. Publishing
  -- a computed "available" would freeze a time-dependent decision into
  -- whatever moment this row was read. The client recomputes these
  -- continuously; the server only needs them to paint the first frame.
  p.request_status,
  p.last_active_at,
  p.auto_close_at,

  -- Effective pricing: the event's override when an event is genuinely
  -- in force, the DJ's own default otherwise. Resolved here so that the
  -- guest page, request creation and checkout cannot disagree about
  -- which price applies.
  coalesce(e.request_price,  p.request_price)   as effective_request_price,
  coalesce(e.shoutout_price, p.shoutout_price)  as effective_shoutout_price,

  -- The event's identity, needed for the 5E event-switch guard so a
  -- guest cannot be shown Event A's price and charged Event B's. Null
  -- for a Free DJ, and null for a lapsed Pro DJ, without either case
  -- revealing which of the two it was.
  e.id   as effective_event_id,
  e.name as effective_event_name

from public.dj_profiles p

-- The entitlement test lives inside the join. An event row belonging to
-- a DJ without Pro entitlement never matches, so its pricing simply does
-- not apply and the DJ's defaults fall through the coalesce above.
-- Nothing is written and nothing is destroyed: the row comes straight
-- back into force if they resubscribe, which is the 5E rule.
left join lateral (
  select ev.id, ev.name, ev.request_price, ev.shoutout_price
    from public.dj_events ev
   where ev.dj_profile_id = p.id
     and ev.is_active
     and public.is_pro_entitled(p.plan, p.stripe_subscription_status)
   -- dj_events_one_active_per_dj_idx already guarantees at most one
   -- active row per DJ. The ordering and limit are belt and braces so a
   -- future index change cannot turn this into a set-returning join.
   order by ev.created_at desc
   limit 1
) e on true;

comment on view public.public_dj_request_bootstrap is
  'The complete public surface of the guest request page. Runs as owner '
  '(security_invoker = false) so it can evaluate Pro entitlement without '
  'exposing plan or stripe_subscription_status. Its select list is the '
  'entire security boundary for this surface - adding a column here '
  'makes that column public immediately.';

grant select on public.public_dj_request_bootstrap to anon;
grant select on public.public_dj_request_bootstrap to authenticated;
