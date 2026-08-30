-- ============================================================
-- CRM tasks: the things Elliot has to do
--
-- Why a table and not a column
-- ---------------------------
-- next_action is a single text column on crm_contacts, so a contact can
-- hold exactly one task, it cannot be completed without being destroyed,
-- and there is nowhere to record that it ever existed. Every one of
-- those is a limitation of the shape rather than of the code.
--
-- What a task is, and is not
-- --------------------------
-- A task is something Elliot has to do: "Ask Cammy how Saturday went",
-- "Identify the /roxanemetzjyha signup". It is NOT state - awaiting a
-- reply, a venue refusal, incomplete onboarding and readiness to
-- activate are all conditions the CRM already derives or stores
-- elsewhere, and turning them into tasks would produce a list of things
-- that cannot be completed.
--
-- Completing a task means one thing and touches one column. It does not
-- imply contact: last_contact_at is advanced only by logging an
-- interaction, because ticking something off is not talking to someone.
-- The old Mark done conflated the two and recorded contact that never
-- happened.
-- ============================================================

create table if not exists public.crm_tasks (
  id uuid primary key default gen_random_uuid(),

  /* Cascade matches crm_notes: tasks about a relationship that has been
     removed have no meaning on their own. */
  contact_id uuid not null
    references public.crm_contacts(id) on delete cascade,

  /* The thing to do, in Elliot's words. Free text on purpose - a task
     taxonomy would be a second vocabulary to maintain for no gain at
     one operator and a few dozen contacts. */
  title text not null,

  /*
   * Nullable. A task nobody has scheduled is still a task, and forcing a
   * date would recreate the problem this replaces: the old model let a
   * follow-up date exist with nothing to do, and the button that cleared
   * it appeared to do nothing.
   */
  due_at timestamptz,

  /*
   * Null means open, a timestamp means done. Deliberately not a status
   * column beside it: two fields describing one thing is how they drift.
   */
  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.crm_tasks is
  'Things the admin has to do, one row per task, many per contact. '
  'Completing a task writes completed_at and nothing else - it never '
  'implies contact, which only logging an interaction does.';

/* The two reads the Tasks screen and Overview actually make: open tasks
   by due date, and every task for one contact. */
create index if not exists crm_tasks_open_due_idx
  on public.crm_tasks (due_at)
  where completed_at is null;

create index if not exists crm_tasks_contact_idx
  on public.crm_tasks (contact_id, completed_at, due_at);

-- ------------------------------------------------------------
-- updated_at maintenance, reusing the function crm_contacts uses
-- ------------------------------------------------------------
drop trigger if exists crm_tasks_touch_updated_at on public.crm_tasks;
create trigger crm_tasks_touch_updated_at
  before update on public.crm_tasks
  for each row execute function public.crm_touch_updated_at();

-- ============================================================
-- Security: identical to crm_contacts and crm_notes
--
-- RLS on with no policies at all, so anon and authenticated match
-- nothing whatever grants they later acquire. Revokes are per role and
-- by name because PUBLIC is a different grantee from either, and
-- Supabase's default privileges grant new objects in this schema to
-- both directly - the assumption that took the guest request page down
-- on 2026-08-28.
--
-- No FORCE ROW LEVEL SECURITY and no service_role policy: service_role
-- holds BYPASSRLS, so both are inert, and a control that implies
-- protection it does not provide is worse than none.
-- ============================================================
alter table public.crm_tasks enable row level security;

revoke all on public.crm_tasks from public;
revoke all on public.crm_tasks from anon;
revoke all on public.crm_tasks from authenticated;

grant select, insert, update, delete on public.crm_tasks to service_role;
