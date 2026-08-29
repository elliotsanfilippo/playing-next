-- ============================================================
-- CRM contacts and notes: the human half of the DJ funnel
--
-- Why this exists
-- ---------------
-- The objective half of a DJ's funnel position is already in the
-- database and always has been: dj_profiles knows whether onboarding is
-- complete, whether Stripe can receive earnings, and song_requests knows
-- whether money was ever captured. None of that should be maintained by
-- hand, and today it is being maintained by hand in GROWTH_CRM.md.
--
-- What the product genuinely cannot know is the relationship: where a DJ
-- came from, what was said, what is blocking them, when to follow up, and
-- whether a person exists at all before they sign up. That is what these
-- two tables hold, and nothing else.
--
-- The design rule this follows: no DJ data is duplicated here. There is
-- no dj_name, no plan, no earnings column. Anything objective is read
-- live from dj_profiles and song_requests through dj_profile_id.
--
-- Security posture
-- ----------------
-- These tables hold private commercial notes about named people. They are
-- admin-only in the strictest sense available: RLS on, no policies for
-- anon or authenticated, and both roles explicitly revoked. Access is
-- exclusively through /api/admin/* under the service role, behind
-- getAdminUser().
--
-- The revokes are explicit and per-role on purpose. On 2026-08-28,
-- "revoke all from public" was assumed to remove anon's access to a
-- function and did not: Supabase's default privileges grant new objects
-- in this schema to anon and authenticated directly, and PUBLIC is a
-- different grantee from either role. That assumption took the guest
-- request page down. This migration does not repeat it.
-- ============================================================

-- ------------------------------------------------------------
-- Contacts
--
-- One row per person in the pipeline, whether or not they have signed up.
-- dj_profile_id is null for a prospect and set once they are linked to a
-- real account, which is the moment objective lifecycle state takes over.
-- ------------------------------------------------------------
create table if not exists public.crm_contacts (
  id uuid primary key default gen_random_uuid(),

  /* The name to show in the CRM. For a linked contact the DJ's own
     dj_name is authoritative for display; this is what we knew them as
     during outreach, which is often not the same thing. */
  display_name text not null,

  /* How to reach them and where they came from. contact_handle is
     deliberately free text: it may be an Instagram handle, a phone
     number or an email, and forcing a shape would lose information. */
  contact_channel text,
  contact_handle text,

  /*
   * Where this person came from. Free text with suggested values in the
   * UI rather than an enum, so that when UTM capture lands (ROADMAP §6)
   * it can write into this same column without a migration or a second
   * concept of "source".
   */
  acquisition_source text,

  /* Human outreach status. Distinct from the product lifecycle stage,
     which is derived and never stored — see src/lib/djLifecycle.ts. */
  outreach_status text not null default 'prospect'
    check (outreach_status in (
      'prospect', 'contacted', 'interested', 'signing_up',
      'signed_up', 'not_interested', 'lost'
    )),

  /*
   * Why a payments-ready DJ has not taken a first paid request.
   *
   * Constrained to the taxonomy that came out of real cases rather than
   * left free text, because the whole value of this field is being able
   * to count how many DJs share a blocker. "Activated" is deliberately
   * absent: that is a lifecycle stage, derived from whether money was
   * captured, and storing it here would create a second answer to the
   * same question.
   */
  activation_blocker text
    check (activation_blocker is null or activation_blocker in (
      'ready_not_attempted',
      'venue_refused',
      'believes_permission_required',
      'no_suitable_gig',
      'product_or_setup',
      'dj_not_interested',
      'unknown_awaiting_response'
    )),

  /* Operational follow-up state. */
  next_gig_date date,
  last_contact_at timestamptz,
  next_follow_up_at timestamptz,
  next_action text,

  /*
   * The link to the real account. UNIQUE so one DJ profile can never be
   * claimed by two contacts, which is the specific way a CRM merge goes
   * wrong. ON DELETE SET NULL rather than CASCADE: if a DJ profile is
   * ever removed we want to keep the outreach history, not silently lose
   * a person from the pipeline.
   */
  dj_profile_id uuid unique references public.dj_profiles(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.crm_contacts is
  'Human relationship context for the DJ funnel. Admin-only. Objective '
  'lifecycle state is never stored here - it is derived live from '
  'dj_profiles and song_requests via src/lib/djLifecycle.ts.';

comment on column public.crm_contacts.dj_profile_id is
  'Null until the prospect is linked to a real account. UNIQUE so two '
  'contacts can never claim the same DJ. Linking is always a deliberate '
  'action; there is no fuzzy name matching anywhere.';

/* Follow-up queues and the linked/unlinked split are the two things the
   Admin home reads on every load. */
create index if not exists crm_contacts_follow_up_idx
  on public.crm_contacts (next_follow_up_at)
  where next_follow_up_at is not null;

create index if not exists crm_contacts_unlinked_idx
  on public.crm_contacts (created_at)
  where dj_profile_id is null;

-- ------------------------------------------------------------
-- Notes
--
-- A dated log per contact. occurred_at is separate from created_at so a
-- conversation can be recorded after the fact without lying about when
-- it happened.
-- ------------------------------------------------------------
create table if not exists public.crm_notes (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.crm_contacts(id) on delete cascade,
  body text not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.crm_notes is
  'Dated notes against a CRM contact. Admin-only. occurred_at is when the '
  'conversation happened; created_at is when it was written down.';

create index if not exists crm_notes_contact_idx
  on public.crm_notes (contact_id, occurred_at desc);

-- ------------------------------------------------------------
-- updated_at maintenance
-- ------------------------------------------------------------
create or replace function public.crm_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists crm_contacts_touch_updated_at on public.crm_contacts;
create trigger crm_contacts_touch_updated_at
  before update on public.crm_contacts
  for each row execute function public.crm_touch_updated_at();

-- ============================================================
-- Security
--
-- RLS is enabled with NO policies at all. That is deliberate and is the
-- whole access model: with RLS on and no policy, anon and authenticated
-- can read nothing and write nothing, whatever grants they may hold now
-- or acquire later from default privileges. The service role bypasses
-- RLS, which is how /api/admin/* reads these tables behind
-- getAdminUser().
--
-- The revokes below are belt and braces on top of that, and they name
-- anon and authenticated explicitly rather than relying on PUBLIC.
-- ============================================================
alter table public.crm_contacts enable row level security;
alter table public.crm_notes enable row level security;

/* Force, not just enable: without this the table owner would still
   bypass RLS on these tables, and there is no legitimate owner-context
   read of CRM data. */
alter table public.crm_contacts force row level security;
alter table public.crm_notes force row level security;

revoke all on public.crm_contacts from public;
revoke all on public.crm_contacts from anon;
revoke all on public.crm_contacts from authenticated;

revoke all on public.crm_notes from public;
revoke all on public.crm_notes from anon;
revoke all on public.crm_notes from authenticated;

revoke all on function public.crm_touch_updated_at() from public;
revoke all on function public.crm_touch_updated_at() from anon;
revoke all on function public.crm_touch_updated_at() from authenticated;

/*
 * service_role is granted explicitly. It bypasses RLS, but it still needs
 * table privileges, and default privileges are not something to depend on
 * for a table whose whole point is that the wrong role must never read it.
 */
grant select, insert, update, delete on public.crm_contacts to service_role;
grant select, insert, update, delete on public.crm_notes to service_role;

/*
 * FORCE RLS applies to the owner too, so the service role needs a policy
 * of its own rather than relying on the bypass. Scoped to service_role
 * specifically: anon and authenticated match nothing here and therefore
 * still see nothing.
 */
create policy crm_contacts_service_role_all
  on public.crm_contacts
  for all
  to service_role
  using (true)
  with check (true);

create policy crm_notes_service_role_all
  on public.crm_notes
  for all
  to service_role
  using (true)
  with check (true);
