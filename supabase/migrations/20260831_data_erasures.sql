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
  /*
   * qr_box_order was added on 2026-08-31 after a sweep of all 13
   * Production tables found that qr_box_orders holds a full postal
   * address - recipient_name, address_line1, address_line2, city,
   * postcode, country. It is the most sensitive personal data in the
   * database and had appeared in no previous audit. The sweep happened
   * because the first inventory, built from three tables we already knew
   * about, turned out to be incomplete.
   */
  object_type text not null
    check (object_type in (
      'song_request',
      'tip',
      'not_played_report',
      'qr_box_order'
    )),
  object_id uuid not null,

  /*
   * The names of the fields cleared - 'message', 'reason',
   * 'address_line1' - never their values. An array because a single
   * action against one row genuinely clears several fields: erasing a
   * QR box address clears up to six at once, and recording that as one
   * vague event would be less honest than listing them.
   */
  fields_cleared text[] not null default '{}',

  /*
   * Whether the whole row was removed rather than a field cleared.
   *
   * MANUAL ERASURE NEVER SETS THIS TRUE. Decided 2026-08-31: clearing a
   * field satisfies an erasure request, because once the personal field
   * is null the row holds no personal data. Removing the row would be
   * minimisation, which is a different obligation with a different gate.
   *
   * The column exists for the future automatic rule (R4) so that, if it
   * is ever built and armed, its deletions are recorded in the same
   * place by the same shape. It is false for everything the manual
   * workflow can do.
   */
  row_deleted boolean not null default false,

  /*
   * The payment classification at the moment of the action, so the
   * decision can be explained later even after the row it described has
   * changed or gone. Mirrors src/lib/retention.ts exactly.
   *
   * A qr_box_order uses the same three values on the same evidence: an
   * abandoned claim with no PaymentIntent is never_charged, which is the
   * only state whose address the manual workflow may clear. A paid order
   * is preserve, and PN Admin does not offer erasure on it at all -
   * fulfilment, delivery failure, replacement, returns and courier
   * support can each still need the address, and no column in this
   * database can currently prove otherwise.
   */
  classification text not null
    check (classification in ('preserve', 'never_charged', 'unknown')),

  /*
   * The operational privacy-request reference, and nothing else.
   *
   * Constrained to the format rather than merely screened for an @,
   * because "does not contain an @" still leaves a free-text field, and
   * a free-text field on an erasure log is exactly where a well-meaning
   * person pastes a name, a phone number, or the very message that was
   * just erased. A closed format cannot hold any of them.
   *
   *   PR-2026-001
   *   ^^ literal   ^^^^ year   ^^^ sequence, three digits or more
   *
   * The pattern subsumes the previous rule: an address cannot match it,
   * so the separate !~ '@' check is gone rather than kept alongside as a
   * second expression saying less than this one already does.
   *
   * The API must validate the same shape before it writes. This is the
   * backstop, not the only guard - a constraint that rejects a bad value
   * at the last moment produces a 23514 the admin cannot act on, so the
   * readable error belongs in the route and this exists so no other
   * writer can bypass it.
   *
   * Nullable on purpose: a request that arrives without a reference is
   * better recorded with none than given a made-up one.
   */
  request_reference text
    check (
      request_reference is null
      or request_reference ~ '^PR-[0-9]{4}-[0-9]{3,}$'
    ),

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
