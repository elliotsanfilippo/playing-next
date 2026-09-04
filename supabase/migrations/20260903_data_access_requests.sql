-- ============================================================
-- data_access_requests: proof that a privacy request was handled
--
-- NOT APPLIED TO PRODUCTION. Written 2026-09-03, verified against
-- Playing Next Test first.
--
-- What this table is
-- ------------------
-- An audit of the PROCESS, not a record of the person. It says a request
-- arrived, how ownership was verified, what kinds of our records were
-- covered, whether an export was produced, and who did it. It never says
-- who they were or what the records contained.
--
-- The sibling of data_erasures, and the same rule applies with more
-- force: an access request produces a document containing someone's
-- messages, so a log of access requests must not become a second copy of
-- the thing it just disclosed.
--
-- Never stored here: guest email, guest name, message or reason text,
-- the exported payload in any form, or any row id on a refusal.
--
-- Not free of personal data even so
-- ---------------------------------
-- object_ids point at rows that relate to an identifiable person, and
-- received_at and performed_at say when they were in contact with us.
-- That is pseudonymous personal data on the same reasoning as
-- dj_lifecycle_emails. It belongs in DATA_AUDIT.md's inventory, and it
-- needs a retention position. NONE IS SET HERE.
-- ============================================================

create table if not exists public.data_access_requests (
  id uuid primary key default gen_random_uuid(),

  /*
   * The same PR- series as data_erasures: one series across both, so a
   * reference identifies a request rather than a table.
   *
   * Nullable for the same reason it is nullable there: a request that
   * arrives without one is better recorded with none than given a
   * made-up one. The format is closed rather than free text, because a
   * free-text field on a privacy log is exactly where somebody pastes a
   * name or the message that was just exported.
   */
  request_reference text
    check (
      request_reference is null
      or request_reference ~ '^PR-[0-9]{4}-[0-9]{3,}$'
    ),

  /*
   * Three outcomes, and only three.
   *
   *   export_completed      both artefacts produced and handed over
   *   export_failed         generation threw before any file existed
   *   verification_refused  ownership was not proven; nothing disclosed
   *
   * There is deliberately no "started" state. The row is written AFTER
   * generation and before the files are returned, so a crash midway
   * writes nothing at all - which is correct, because nothing was
   * produced and nothing was disclosed. That also keeps this table
   * strictly insert-only, with no settle step and no UPDATE grant.
   */
  outcome text not null
    check (outcome in ('export_completed', 'export_failed', 'verification_refused')),

  /* The method attempted. Null where verification never got that far. */
  verification_method text
    check (
      verification_method is null
      or verification_method in ('stripe_payment', 'my_requests_link', 'quoted_message')
    ),

  /* WHICH KINDS, and which of OUR row ids. Never their contents. */
  object_types text[] not null default '{}',
  object_ids uuid[] not null default '{}',

  /* Which artefacts were produced, and what made them. */
  formats text[] not null default '{}',
  schema_version text,
  generator_version text,

  /*
   * Three timestamps, three different facts. received_at is entered by
   * the admin and is the statutory clock: the moment the request entered
   * our process, which is not the moment we acted on it.
   */
  received_at timestamptz not null,
  performed_by text not null,
  performed_at timestamptz not null default now(),

  /*
   * A refusal is an audit of the process, not a record of a person, and
   * the database enforces that rather than trusting every future caller
   * to remember it. A refused request physically cannot carry record
   * ids, formats or a schema.
   */
  constraint data_access_requests_refusal_is_bare check (
    outcome <> 'verification_refused'
    or (
      object_types = '{}'
      and object_ids = '{}'
      and formats = '{}'
      and schema_version is null
    )
  ),

  /* A completed export must be able to say which schema produced it. */
  constraint data_access_requests_export_is_described check (
    outcome <> 'export_completed' or schema_version is not null
  ),

  /*
   * Added on review, 2026-09-03. A completed export means BOTH artefacts
   * were produced: the human-readable PDF and the machine-readable JSON
   * are one deliverable, not two options. Without this a half-export -
   * JSON written, PDF thrown - could be recorded as complete, and the
   * audit would say we answered a request more fully than we did.
   *
   * Containment rather than equality, so a future third format does not
   * require a migration to this constraint.
   */
  constraint data_access_requests_export_has_both_formats check (
    outcome <> 'export_completed'
    or formats @> array['pdf', 'json']::text[]
  )
);

comment on table public.data_access_requests is
  'Audit of privacy access requests: that one arrived, how ownership was '
  'verified, which kinds of our records were covered and whether an '
  'export was produced. Holds no guest email, name, message text or '
  'exported payload, and no row ids at all on a refusal. IS pseudonymous '
  'personal data by way of object_ids and belongs in the data inventory.';

comment on column public.data_access_requests.received_at is
  'When the request entered our process, entered by the admin. The '
  'statutory clock, and deliberately not the same as performed_at.';

comment on column public.data_access_requests.outcome is
  'Written after generation and before the files are returned, so a '
  'crash midway records nothing - correct, because nothing was produced '
  'and nothing disclosed.';

comment on column public.data_access_requests.object_ids is
  'OUR row ids, never anything of theirs. Empty on a refusal, and empty '
  'on a nil return, which is a valid complete answer.';

create index if not exists data_access_requests_performed_idx
  on public.data_access_requests (performed_at desc);

-- ============================================================
-- Security
--
-- The data_erasures posture exactly: RLS on with no policies at all,
-- plus explicit per-role revokes, so anon and authenticated read and
-- write nothing whatever grants they hold now or later acquire from
-- Supabase's default privileges.
--
-- UPDATE is NOT granted, unlike dj_lifecycle_emails. That table needed
-- it because a claimed row must settle; this one has no settle step by
-- design, so it is append-only in the strict sense.
--
-- DELETE and TRUNCATE are revoked explicitly rather than merely left out
-- of the GRANT. That is the 2026-08-31 lesson: a GRANT describes what is
-- added, never what is withheld, and data_erasures shipped believing
-- otherwise. Verified after applying rather than assumed.
-- ============================================================
alter table public.data_access_requests enable row level security;

revoke all on public.data_access_requests from public;
revoke all on public.data_access_requests from anon;
revoke all on public.data_access_requests from authenticated;

grant select, insert on public.data_access_requests to service_role;
revoke update, delete, truncate on public.data_access_requests from service_role;
