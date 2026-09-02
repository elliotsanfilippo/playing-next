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
