-- ============================================================
-- Setup-reminder suppression, scoped to one category
--
-- NOT APPLIED. Written 2026-09-01 for review under ROADMAP §12a.
--
-- Why a category and not a global flag
-- ------------------------------------
-- A DJ who stops setup reminders must still receive password resets,
-- email verification, QR box order confirmations and anything about
-- money. Those are transactional, they are not consentable in the same
-- way, and suppressing them because somebody clicked "stop reminders"
-- on a nudge would be a worse failure than never sending the nudge.
--
-- So this column is read by exactly one thing: the onboarding-recovery
-- job. It is named for what it suppresses rather than for email in
-- general, so that a future sequence has to make its own decision
-- rather than silently inheriting this one.
--
-- The separation is partly structural and worth noting: Supabase Auth
-- sends verification and password reset from its own templates and its
-- own sender, so those cannot be affected by anything in this schema
-- even by mistake. The QR box emails go through src/lib/email.ts and
-- must not learn about this column.
--
-- Built to the stricter standard on purpose
-- -----------------------------------------
-- Whether these emails are service or marketing communications under UK
-- GDPR and PECR is a question for the solicitor already engaged for the
-- four legal documents, and is not decided here. This column exists so
-- that the answer matters less: the cost of honouring an opt-out we may
-- not have strictly needed is one boolean, and the cost of not having
-- one if the answer goes the other way is a compliance problem.
--
-- Default false, not null
-- -----------------------
-- No DJ has opted out of something that has never been sent. A NULL
-- would create a third state ("unknown") that the job would have to
-- interpret, and every interpretation of it is a guess.
-- ============================================================

alter table public.dj_profiles
  add column if not exists lifecycle_emails_opted_out boolean not null default false;

comment on column public.dj_profiles.lifecycle_emails_opted_out is
  'True when the DJ has asked to stop setup reminders. Read ONLY by the '
  'onboarding-recovery job. Never suppresses transactional, auth, '
  'payment or order email, which are a different category and mostly '
  'sent by Supabase Auth rather than by us.';

/*
 * No grant changes, and this is load-bearing rather than an omission.
 *
 * anon holds SELECT on a hand-listed set of columns and reads the guest
 * page through public.public_dj_request_bootstrap, whose select list is
 * written out by hand. Adding a column to dj_profiles grants nobody
 * anything and does not appear in that view, so whether a DJ has opted
 * out of reminders is not visible to guests. That column allowlist is
 * the public data boundary and this migration does not widen it.
 *
 * Same reasoning as 20260830_lifecycle_timestamps.sql, restated rather
 * than assumed, because "adding a column is harmless" is the kind of
 * belief that is true right up until the view uses select *.
 */
