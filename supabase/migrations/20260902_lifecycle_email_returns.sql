-- ============================================================
-- Did the DJ come back, and can we even tell?
--
-- NOT APPLIED TO PRODUCTION. Written 2026-09-02, verified against
-- Playing Next Test first.
--
-- This is the first-party alternative to provider tracking. Resend's
-- open tracking injects a 1x1 pixel and its click tracking rewrites
-- every link through a tracking subdomain while recording IP address
-- and user agent per click. Both stay off. Instead the product records
-- the thing that actually matters, from the place it can be known
-- honestly: a DJ, signed in as themselves, arriving on a page the email
-- pointed at.
--
-- Nothing here stores an address, an IP, a user agent, or anything
-- about a guest.
-- ============================================================

alter table public.dj_lifecycle_emails
  add column if not exists returned_at timestamptz;

comment on column public.dj_lifecycle_emails.returned_at is
  'First time the DJ reached an authenticated Playing Next page carrying '
  'this email''s from=recovery_N marker. Write-once, enforced by trigger. '
  'Never set from an open, a pixel, or any provider signal.';

-- ------------------------------------------------------------
-- The honesty column
--
-- NULL returned_at means two completely different things, and conflating
-- them would produce exactly the misleading number this design exists to
-- avoid:
--
--   "they did not come back"        - a real, measured zero
--   "we cannot know either way"     - the nine R1 emails sent on
--                                     2026-09-02, whose CTA used
--                                     ?from=onboarding, a marker four
--                                     in-product buttons also produce
--
-- Those nine can never be click-attributed, and inferring a return for
-- them would be inventing data. So the distinction is stored rather than
-- reasoned about later.
--
-- Why a column and not a cutoff timestamp in the code: a constant like
-- "sends after 2026-09-02T21:00Z are trackable" is a magic number that
-- has to be kept true by hand for ever, and it silently becomes wrong
-- the first time anyone backfills, replays or re-sends anything. The row
-- knowing its own answer cannot drift.
--
-- The default is true because every email sent from now on carries the
-- marker. The update below then corrects the only rows that do not: the
-- ones that already exist, all of which predate the marker by
-- definition, because this migration ships with it.
-- ------------------------------------------------------------
alter table public.dj_lifecycle_emails
  add column if not exists return_tracked boolean not null default true;

update public.dj_lifecycle_emails set return_tracked = false;

comment on column public.dj_lifecycle_emails.return_tracked is
  'False for emails sent before the from=recovery_N marker existed, whose '
  'returns are unknowable rather than zero. Reports must never count '
  'these in a return-rate denominator.';

-- ============================================================
-- returned_at is write-once, enforced by the database
--
-- The application already writes it with "and returned_at is null", so
-- the conditional update is what normally protects it. This exists
-- because that protects it only while every caller remembers to, and a
-- first return is a historical fact about a person: once recorded it is
-- either true or it never happened, and there is no version of "correct"
-- that involves moving it later or erasing it.
--
-- One condition covers both prohibited transitions. "is distinct from"
-- rather than "<>" because clearing to NULL is precisely one of the
-- things being stopped, and "new.returned_at <> old.returned_at" returns
-- NULL for that case, which is not true, which would let it through.
--
-- Same shape as dj_lifecycle_emails_sent_is_final, kept as its own
-- trigger rather than folded into that one: they guard different facts
-- and each WHEN clause stays cheap and readable.
-- ============================================================
create or replace function public.dj_lifecycle_emails_return_is_final()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.returned_at is distinct from old.returned_at then
    raise exception
      'returned_at is write-once (id %, recorded %, attempted %).',
      old.id, old.returned_at, new.returned_at
      using errcode = 'restrict_violation';
  end if;

  return new;
end;
$$;

comment on function public.dj_lifecycle_emails_return_is_final() is
  'Refuses any update that changes or clears a returned_at that is '
  'already set. The first return is a historical fact, not a value.';

/*
 * WHEN (old.returned_at is not null) means the body runs only for rows
 * that have something to protect. The very first write, NULL to a
 * timestamp, never reaches the function at all, which is what makes the
 * column write-once rather than write-never.
 */
drop trigger if exists dj_lifecycle_emails_return_is_final on public.dj_lifecycle_emails;
create trigger dj_lifecycle_emails_return_is_final
  before update on public.dj_lifecycle_emails
  for each row
  when (old.returned_at is not null)
  execute function public.dj_lifecycle_emails_return_is_final();

/*
 * No grant changes. Both columns inherit the table's existing
 * privileges, which are select, insert and update for service_role and
 * nothing at all for anon and authenticated, with RLS on and no
 * policies. Adding a column grants nobody anything.
 */

-- ============================================================
-- What the DJ actually received
--
-- template_key plus state_at_send can render TODAY's subject. It cannot
-- render the one that was sent, and that difference is not theoretical:
-- the R1 state A subject changed from "Your Playing Next page cannot
-- take payment yet" to "Two steps from your first paid request" within
-- three days of being written. Reconstructing from current code would
-- quietly rewrite what nine real people saw in their inbox.
--
-- So the subject is stored as a fact rather than derived as a guess.
-- The BODY is deliberately not stored: the subject is the line that
-- identifies the message in a list, and keeping the body would turn a
-- delivery record into a copy of our own mail.
--
-- It carries no personal data. Subjects are template-level copy,
-- identical for every DJ in the same state, with no name, no address
-- and nothing personalised in them.
--
-- Nullable because the nine sent on 2026-09-02 predate the column. They
-- are backfilled from Resend's own record of each provider_message_id,
-- which is what was really sent, not a reconstruction.
-- ============================================================
alter table public.dj_lifecycle_emails
  add column if not exists subject_at_send text;

comment on column public.dj_lifecycle_emails.subject_at_send is
  'The exact subject line the DJ received. Stored rather than derived, '
  'because template copy changes and history must not change with it. '
  'Never the body.';

-- ============================================================
-- What the provider told us happened next
--
-- One state and one timestamp rather than an event-history table. At
-- this scale a table of every webhook we have ever received would be
-- more machinery than the question deserves, and the question is only
-- ever "what is the latest thing we know about this message".
--
-- delivery_state_at is the PROVIDER's event time, taken from the
-- signed webhook payload's top-level created_at, which Resend documents
-- as when the event occurred. Our own receipt time would be wrong by
-- however long the webhook took to arrive or be retried, and it is not
-- the thing anybody means by "Delivered 21:57".
--
-- Both are null for the nine already sent. Resend's API reports their
-- current status but not the moment of delivery, so those rows get the
-- state and no time, and PN Admin renders "Delivered" without a clock
-- rather than inventing one.
-- ============================================================
alter table public.dj_lifecycle_emails
  add column if not exists delivery_state text
    check (delivery_state is null or delivery_state in (
      'delayed', 'delivered', 'bounced', 'failed', 'complained'
    ));

alter table public.dj_lifecycle_emails
  add column if not exists delivery_state_at timestamptz;

comment on column public.dj_lifecycle_emails.delivery_state is
  'Latest provider outcome, ranked so a weaker or duplicate event can '
  'never overwrite a stronger one. Set only by the verified Resend '
  'webhook.';

comment on column public.dj_lifecycle_emails.delivery_state_at is
  'The provider event time from the signed payload, not our receipt '
  'time. Null where the provider cannot tell us, which is not the same '
  'as the event not happening.';

-- ------------------------------------------------------------
-- Deterministic precedence
--
-- Webhooks are at-least-once and can arrive out of order, so the same
-- message may produce delayed after delivered, or delivered twice. The
-- rank makes both harmless without a dedup table: a state may only move
-- upward.
--
--   0  nothing known yet
--   1  delayed      a temporary problem, still in flight
--   2  delivered    accepted by the recipient's mail server
--   3  bounced      permanently rejected
--   3  failed       we could not send it at all
--   4  complained   delivered, and then reported as spam
--
-- complained outranks delivered because it happens afterwards and is
-- the more consequential fact about the relationship. bounced and
-- failed share a rank: both are terminal and neither follows the other.
-- ------------------------------------------------------------
create or replace function public.delivery_state_rank(state text)
returns int
language sql
immutable
set search_path = ''
as $$
  /*
   * NULL for an unrecognised value, and 0 for a genuinely absent one.
   *
   * That distinction is load-bearing. The comparison in the trigger is
   * "rank(new) <= rank(old)", and NULL makes that expression NULL rather
   * than true, so an unrecognised state is NOT coerced away and falls
   * through to the check constraint, which rejects it properly with
   * 23514. Returning 0 for everything unknown, as the first version did,
   * silently rewrote a bad value to NULL and the constraint never saw
   * it: a typo in a handler would have been swallowed instead of caught.
   */
  select case
    when state is null        then 0
    when state = 'delayed'    then 1
    when state = 'delivered'  then 2
    when state = 'bounced'    then 3
    when state = 'failed'     then 3
    when state = 'complained' then 4
    else null
  end;
$$;

comment on function public.delivery_state_rank(text) is
  'Ordering for delivery_state so out-of-order or duplicate webhooks '
  'cannot walk a message backwards.';

/*
 * This trigger COERCES rather than raising, which is the opposite of
 * the two write-once guards on this table, and the difference is
 * deliberate.
 *
 * Those protect facts a person would be wrong to change. This one
 * absorbs a message a machine will legitimately send more than once. A
 * webhook handler that returned an error for a duplicate would make
 * Resend retry it, for ever, over an event we had already recorded
 * correctly. So a weaker event is silently discarded and the handler
 * can write unconditionally, which is what makes the whole path
 * idempotent.
 */
create or replace function public.dj_lifecycle_emails_delivery_forward_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.delivery_state_rank(new.delivery_state)
     <= public.delivery_state_rank(old.delivery_state) then
    new.delivery_state := old.delivery_state;
    new.delivery_state_at := old.delivery_state_at;
  end if;

  return new;
end;
$$;

comment on function public.dj_lifecycle_emails_delivery_forward_only() is
  'Keeps the higher-ranked delivery state. Discards duplicates and '
  'out-of-order webhooks silently, because erroring would make the '
  'provider retry an event we already handled.';

drop trigger if exists dj_lifecycle_emails_delivery_forward_only on public.dj_lifecycle_emails;
/*
 * Fires once the row knows anything about delivery, rather than only
 * when the state would change.
 *
 * The first version used "old.delivery_state is distinct from
 * new.delivery_state", which looks right and is wrong for the commonest
 * case there is: a duplicate webhook carries the SAME state, so the
 * clause was false, the trigger never ran, and the later event time
 * overwrote the real one. "Delivered 23:59" instead of "Delivered
 * 21:57", from an event that told us nothing new. Caught against the
 * test project rather than in Production.
 *
 * With this condition the equal-rank case reaches the function and is
 * coerced back to the recorded values, which is what makes a repeat
 * genuinely a no-op. The very first event, where old is null, still
 * bypasses the trigger and is simply written.
 */
create trigger dj_lifecycle_emails_delivery_forward_only
  before update on public.dj_lifecycle_emails
  for each row
  when (old.delivery_state is not null)
  execute function public.dj_lifecycle_emails_delivery_forward_only();
