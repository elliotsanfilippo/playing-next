-- ============================================================
-- 4D.1  Checkout session lifecycle
--
-- Adds the missing link from our rows back to Stripe.
--
-- Today the association is one-directional: a Stripe Checkout Session
-- carries metadata.requestId (or metadata.tipId), so Stripe can find us,
-- but we store nothing that lets us find the session. That is why an
-- abandoned checkout cannot be reasoned about from our side, and why a
-- session that fails to be created at all leaves a row that nothing can
-- ever resolve.
--
-- Nullable and additive. No existing row changes, no data is rewritten,
-- and nothing is backfilled — the ids were never recorded, so there is
-- nothing to backfill from. Every pre-existing row keeps NULL, which is
-- exactly what "we do not know which session this was" should look like.
-- ============================================================

alter table public.song_requests
  add column if not exists stripe_checkout_session_id text;

alter table public.tips
  add column if not exists stripe_checkout_session_id text;

-- A Stripe Checkout Session belongs to exactly one request (or one tip),
-- so uniqueness is correct and worth enforcing: it makes a duplicated or
-- mis-assigned session a database error rather than a silent
-- reconciliation bug. Partial, because NULL means "not recorded" and
-- there will be many of those — both historically and for any row whose
-- session creation failed.
create unique index if not exists song_requests_checkout_session_id_key
  on public.song_requests (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create unique index if not exists tips_checkout_session_id_key
  on public.tips (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

-- The defensive sweep looks for rows stuck mid-checkout past the Stripe
-- session lifetime. Partial indexes so they stay small: they only cover
-- the handful of rows actually in flight, not the whole table.
create index if not exists song_requests_stale_checkout_idx
  on public.song_requests (created_at)
  where request_status = 'checkout_pending';

create index if not exists tips_stale_checkout_idx
  on public.tips (created_at)
  where status = 'pending';

comment on column public.song_requests.stripe_checkout_session_id is
  'Stripe Checkout Session that was opened for this request. NULL means no session was successfully created and recorded. Used for reconciliation and stale-checkout cleanup.';

comment on column public.tips.stripe_checkout_session_id is
  'Stripe Checkout Session that was opened for this tip. NULL means no session was successfully created and recorded.';
