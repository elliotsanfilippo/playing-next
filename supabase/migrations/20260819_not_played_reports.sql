-- Guest-reported "this wasn't played" disputes.
--
-- Deliberately separate from the existing chargeback_disputes table and
-- the "disputed" song_requests.request_status value — those represent a
-- Stripe/bank-initiated chargeback, a different concept from a guest
-- saying their accepted or played request was never actually played.
-- Reusing "disputed" for this would make the guest-facing status maps
-- in src/lib/requestStatus.ts, my-requests/page.tsx and
-- confirmation/page.tsx misreport a guest report as a bank chargeback.

alter table public.song_requests
  add column if not exists reported_not_played_at timestamptz;

create table if not exists public.not_played_reports (
  id uuid primary key default gen_random_uuid(),
  song_request_id uuid not null references public.song_requests(id),
  dj_profile_id uuid not null references public.dj_profiles(id),
  reason text,
  resolution text not null default 'pending'
    check (resolution in ('pending', 'refunded', 'denied')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists not_played_reports_dj_profile_id_idx
  on public.not_played_reports (dj_profile_id);

create index if not exists not_played_reports_song_request_id_idx
  on public.not_played_reports (song_request_id);

-- Deny-all RLS, same convention as song_requests and chargeback_disputes:
-- no policies means no anon/authenticated access at all. Every read or
-- write goes through a service-role API route.
alter table public.not_played_reports enable row level security;
