-- ============================================================
-- dj_lifecycle_emails: which lifecycle email went to which DJ
--
-- NOT APPLIED. Written 2026-09-01 for review under ROADMAP §12a.
--
-- What this table is for
-- ----------------------
-- Two things, and deliberately only two:
--
--   1. Idempotency. The unique index below is what makes it impossible
--      to send the same recovery email to the same DJ twice. That
--      guarantee lives in Postgres rather than in an application check,
--      because two overlapping cron invocations would both pass an
--      application check and both send.
--
--   2. Visibility. PN Admin can show that a nudge was sent, and when,
--      without anyone having to remember.
--
-- What it must never become
-- -------------------------
-- A second source of lifecycle truth. Nothing in this table is ever an
-- input to resolveLifecycleStage(), the funnel counts, or a Contacts
-- group. A DJ who received two emails and ignored them is in exactly
-- the same lifecycle state as one who received none. The CRM was built
-- to kill a hand-maintained pipeline; this table must not quietly
-- become a new one.
--
-- What it deliberately does not store
-- -----------------------------------
-- No email address, no hash of one, and no copy of the rendered body.
-- The recipient is resolved at send time from auth.users via
-- auth.admin.getUserById(), which is the same path the QR box
-- confirmation already uses. That means an address change or an erasure
-- is honoured automatically and there is no second copy to keep in
-- step.
--
-- This table is NOT free of personal data
-- ---------------------------------------
-- Corrected 2026-09-01 after the audit overstated this. Storing no
-- address is good minimisation, but dj_profile_id, send timestamps and
-- the provider message id together are a pseudonymous record of when a
-- identifiable person was contacted. They are personal data under UK
-- GDPR by way of the profile they point at.
--
-- Consequences, both deliberate:
--   * This table belongs in DATA_AUDIT.md's inventory. It is not exempt
--     because it holds no address.
--   * It needs a retention position. NONE IS SET HERE. Inventing a
--     duration to unblock this build is exactly what was ruled out for
--     the financial-record period in ROADMAP §13. Assessed separately.
--
-- The provider message id is included because a real deliverability
-- question ("did this DJ actually receive it?") cannot be answered
-- without it, and Resend holds the delivery record anyway. It is an
-- opaque provider reference, not content.
-- ============================================================

create table if not exists public.dj_lifecycle_emails (
  id uuid primary key default gen_random_uuid(),

  /* Cascades, so erasing or deleting a DJ takes their send history with
     it. The history is meaningless without the profile it points at,
     and leaving orphans would be keeping a record of contact with
     somebody we can no longer identify, which is the worst of both. */
  dj_profile_id uuid not null
    references public.dj_profiles (id) on delete cascade,

  /*
   * Which email. A closed set rather than free text, for the same
   * reason data_erasures.request_reference is a closed format: an open
   * text column on a table the cron writes to is where a typo becomes a
   * second send. A new template means a migration, which is the correct
   * amount of friction for something that emails real DJs.
   */
  template_key text not null
    check (template_key in ('recovery_1', 'recovery_2')),

  /*
   * The computed state at the moment of sending: A both outstanding,
   * B payouts only, C profile only.
   *
   * Recorded because the DJ's state will have moved on by the time
   * anyone asks why they got this email, and "which variant did they
   * see" is otherwise unanswerable. It is a description of a past
   * decision, not a state anything reads back.
   */
  state_at_send text not null
    check (state_at_send in ('A', 'B', 'C')),

  /*
   * claimed -> sent, or claimed -> failed.
   *
   * The row is inserted as 'claimed' BEFORE the provider is called.
   * This is the opposite trade to Phase 6D's erasure, where the write
   * and its audit record had to be one transaction so no audit row
   * could claim an erasure that did not happen. The reasoning is
   * inverted here because the unacceptable outcomes are inverted:
   *
   *   there   an audit row claiming an erasure that did not happen
   *   here    a DJ receiving the same email twice
   *
   * A duplicate email cannot be withdrawn. A missed one is recoverable
   * and invisible. So we claim first and accept that a crash between
   * the claim and the send costs one email.
   */
  status text not null default 'claimed'
    check (status in ('claimed', 'sent', 'failed')),

  /* Resend's id. Null until a send succeeds. */
  provider_message_id text,

  /*
   * Bounded retry. A failed row is retried on later runs up to
   * MAX_EMAIL_ATTEMPTS and then left alone for ever. There is no
   * unbounded retry loop, for the same reason there is no third
   * reminder.
   */
  attempts smallint not null default 0,

  created_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error_at timestamptz
);

/*
 * THE IDEMPOTENCY. One row per DJ per template, enforced by the
 * database. The insert that claims a send either succeeds or raises
 * 23505, and 23505 means "already sent, skip this DJ" rather than an
 * error worth reporting.
 *
 * Everything else in this file is bookkeeping. This line is the
 * guarantee.
 */
create unique index if not exists dj_lifecycle_emails_once
  on public.dj_lifecycle_emails (dj_profile_id, template_key);

create index if not exists dj_lifecycle_emails_profile_idx
  on public.dj_lifecycle_emails (dj_profile_id, created_at desc);

comment on table public.dj_lifecycle_emails is
  'Which lifecycle email was sent to which DJ, and when. Holds no email '
  'address and no message body, but IS pseudonymous personal data by way '
  'of dj_profile_id and belongs in the data inventory. Never an input to '
  'lifecycle stage resolution.';

comment on index public.dj_lifecycle_emails_once is
  'The guarantee that a DJ cannot receive the same recovery email twice. '
  'Enforced here rather than in application code because concurrent cron '
  'invocations would both pass an application check.';

comment on column public.dj_lifecycle_emails.status is
  'Inserted as claimed BEFORE the provider call. A crash between claim '
  'and send loses one email, which is the correct trade against sending '
  'a duplicate that cannot be withdrawn.';

-- ============================================================
-- "sent" is final, enforced by the database
--
-- Approved 2026-09-02. The retry claim in the application already
-- refuses to touch a sent row: it compares and swaps on
-- status = 'failed', so a sent row can never win a claim. Proven
-- against the test project, eight concurrent claims against a sent row,
-- zero winners.
--
-- This trigger exists because that proof covers the code we have, not
-- the code we will have, and not a person with the SQL editor open. If
-- a sent row is ever moved back to 'failed' or 'claimed' it becomes
-- eligible for a claim again, and the DJ receives a second copy of an
-- email they already got. That cannot be withdrawn.
--
-- So the rule is stated where it cannot be bypassed, which is the same
-- reasoning that put the idempotency in a unique index rather than in an
-- application check, and the same reasoning behind the write-once
-- lifecycle stamps in 20260830_lifecycle_timestamps.sql.
--
-- What it does NOT block: updating anything else on a sent row.
-- Correcting or backfilling provider_message_id, or any other column,
-- is still allowed. Only a status transition away from 'sent' raises.
-- ============================================================
create or replace function public.dj_lifecycle_emails_sent_is_final()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  /* "is distinct from" rather than "<>": status is NOT NULL today, but a
     comparison that returns NULL instead of true would silently permit
     the exact transition this exists to stop, and that failure would be
     invisible until a DJ complained about a duplicate. */
  if old.status = 'sent' and new.status is distinct from 'sent' then
    raise exception
      'A sent lifecycle email cannot be reopened (id %, attempted status %).',
      old.id, new.status
      using errcode = 'restrict_violation';
  end if;

  return new;
end;
$$;

comment on function public.dj_lifecycle_emails_sent_is_final() is
  'Refuses any update that moves a row out of status = sent. Reopening a '
  'sent row would make it eligible for another claim and send the DJ a '
  'duplicate email that cannot be withdrawn.';

/*
 * The WHEN clause is for cost, not correctness. Rows are updated on
 * every claim and every settle, and without it this function would
 * execute on all of them; with it, the body runs only for the rows that
 * could possibly violate the rule. The body still repeats the check,
 * because a trigger whose only guard is its WHEN clause is one careless
 * edit away from doing nothing.
 */
drop trigger if exists dj_lifecycle_emails_sent_is_final on public.dj_lifecycle_emails;
create trigger dj_lifecycle_emails_sent_is_final
  before update on public.dj_lifecycle_emails
  for each row
  when (old.status = 'sent')
  execute function public.dj_lifecycle_emails_sent_is_final();

-- ============================================================
-- Security
--
-- The posture from crm_contacts and data_erasures: RLS on with no
-- policies at all, plus explicit per-role revokes. With RLS enabled and
-- no policy, anon and authenticated read and write nothing whatever
-- grants they hold now or later acquire from Supabase's default
-- privileges. service_role holds BYPASSRLS and reaches this table only
-- from the cron route and the admin-triggered run.
--
-- The revokes are written out per role, and DELETE and TRUNCATE are
-- revoked explicitly rather than merely left out of the GRANT.
--
-- That is the lesson from 2026-08-31, and it is worth restating because
-- it has now caused a defect in both directions. On 2026-08-28 "revoke
-- all from public" was assumed to cover anon and did not, and took the
-- guest request page down. On 2026-08-31 "grant select, insert" was
-- assumed to withhold update and delete and did not, because Supabase's
-- default privileges had already granted service_role everything and a
-- GRANT describes what is added, never what is withheld. Verified in
-- Production that day: UPDATE and DELETE returned 200 rather than 42501.
--
-- So this table names what it wants and revokes what it does not, and
-- the result is verified after applying rather than assumed.
--
-- UPDATE is granted here, unlike on data_erasures, because a claimed row
-- must be able to become sent or failed. That makes this table
-- append-and-settle, not append-only. DELETE is not granted: a send
-- either happened or did not, and removing the evidence is not a
-- correction.
-- ============================================================
alter table public.dj_lifecycle_emails enable row level security;

revoke all on public.dj_lifecycle_emails from public;
revoke all on public.dj_lifecycle_emails from anon;
revoke all on public.dj_lifecycle_emails from authenticated;

grant select, insert, update on public.dj_lifecycle_emails to service_role;
revoke delete, truncate on public.dj_lifecycle_emails from service_role;
