-- ============================================================
-- data_erasures: proof that an erasure happened
--
-- What this table is for
-- ----------------------
-- Complying with an erasure request means being able to show it was
-- carried out. This records that fact and nothing else.
--
-- The minimisation rule, which is the whole design
-- ------------------------------------------------
-- A log of erasures must never become a copy of the data it erased.
-- That failure mode is easy to walk into - "keep the old value so we can
-- undo it" - and it would leave the personal data in the database under
-- a different name, which is not erasure at all.
--
-- So this table stores WHICH FIELDS were cleared, never their contents.
-- There is deliberately no before_value column, no payload column, and
-- no guest identifier of any kind.
--
-- Explicitly excluded, per Elliot's instruction 2026-08-31:
--   erased guest message text, erased report reason, erased tip message,
--   guest email, full Stripe payloads, card or payment details, and any
--   copy whatsoever of the erased personal data.
--
-- The consequence is accepted deliberately: an erasure cannot be undone
-- from this log. That is the correct trade. Recovery, if it is ever
-- needed, comes from a database backup, not from a table whose purpose
-- is to prove data is gone.
-- ============================================================

create table if not exists public.data_erasures (
  id uuid primary key default gen_random_uuid(),

  /* Which kind of row was acted on, and which row. The internal UUID is
     ours, not the subject's - it identifies a record, not a person, and
     without the row it points at it identifies nothing. */
  object_type text not null
    check (object_type in ('song_request', 'tip', 'not_played_report')),
  object_id uuid not null,

  /*
   * The names of the fields cleared - 'message', 'reason' - never their
   * values. An array so a single action against one row can record more
   * than one field honestly.
   */
  fields_cleared text[] not null default '{}',

  /* True only where the whole row was removed, which the design permits
     for a positively-established never-charged row and nothing else. */
  row_deleted boolean not null default false,

  /*
   * The payment classification at the moment of the action, so the
   * decision can be explained later even after the row it described has
   * changed or gone. Mirrors src/lib/retention.ts exactly.
   */
  classification text not null
    check (classification in ('preserve', 'never_charged', 'unknown')),

  /*
   * How the request arrived, as a short internal reference: a ticket id,
   * a date, "email request". NOT the guest's email address and NOT their
   * message.
   *
   * The CHECK enforces that structurally rather than trusting whoever
   * fills it in. An address cannot be stored here even by accident,
   * because an erasure log is exactly the place a well-meaning person
   * would paste one "for context". Drop the constraint if a legitimate
   * reference ever needs an @ in it.
   */
  request_reference text
    check (request_reference is null or request_reference !~ '@'),

  /* Which admin ran it. An operator identity from the allowlist, not a
     data subject. */
  performed_by text not null,

  performed_at timestamptz not null default now()
);

comment on table public.data_erasures is
  'Proof that an erasure was carried out. Records which fields were '
  'cleared on which row, never their contents. Holds no personal data '
  'about any data subject and must never be extended to.';

comment on column public.data_erasures.fields_cleared is
  'Field NAMES only. Adding a column that stores the erased values would '
  'defeat the entire purpose of this table.';

create index if not exists data_erasures_object_idx
  on public.data_erasures (object_type, object_id);

create index if not exists data_erasures_performed_idx
  on public.data_erasures (performed_at desc);

-- ============================================================
-- Security
--
-- The same posture as crm_contacts, and for the same reason: RLS on with
-- no policies at all, plus explicit per-role revokes. With RLS enabled
-- and no policy, anon and authenticated read nothing and write nothing
-- whatever grants they hold now or later acquire from Supabase's default
-- privileges. service_role holds BYPASSRLS and reaches this table only
-- through /api/admin routes behind getAdminUser().
--
-- The revokes are per-role on purpose. On 2026-08-28 "revoke all from
-- public" was assumed to cover anon and did not, because Supabase grants
-- new objects in this schema to anon and authenticated directly and
-- PUBLIC is a different grantee from either. That assumption took the
-- guest request page down.
--
-- No UPDATE or DELETE grant, for anyone. An audit record that can be
-- edited or removed is not evidence. Corrections are made by writing a
-- further row, never by rewriting history.
-- ============================================================
alter table public.data_erasures enable row level security;

revoke all on public.data_erasures from public;
revoke all on public.data_erasures from anon;
revoke all on public.data_erasures from authenticated;

grant select, insert on public.data_erasures to service_role;
