-- ============================================================
-- One Playing Next per DJ, enforced rather than assumed
--
-- The dashboard has always been written as though a DJ has zero or one
-- request cued up: the card says "Playing next: <song>", singular, and
-- reads playingNextRequests[0]. Nothing enforced it. Tapping Play Next
-- on a second queued track simply set a second row to playing_next.
--
-- The consequence was worse than a cosmetic duplicate. The extra row
-- left the Queue (its status is no longer "accepted"), was not rendered
-- by the Playing Next card (which only ever reads the first), and was
-- not in Played — so it disappeared from the dashboard entirely while
-- still counting toward the DJ's earnings and still consuming a slot
-- against their queue cap. Money counted, capacity consumed, nothing on
-- screen to act on.
--
-- Two things are needed, and one without the other is not enough:
--
--   * the index, so the database refuses a second cued request no
--     matter which client asks or how stale it is, and
--   * the function, so promoting a new request and demoting the old one
--     happen in one transaction rather than as two writes that can be
--     interleaved by a second device.
--
-- Where the previous request goes
-- -------------------------------
-- Back to "accepted", at the queue position it already held.
--
-- It was not played — the DJ changed their mind about what is next — so
-- sending it to "played" would both lie to the guest (whose copy reads
-- "The DJ marked this as played") and count a track that never played
-- toward tonight's earnings. "accepted" is the honest state: the guest's
-- copy for it, "The DJ accepted your request and added it to their
-- queue. Your payment has now been taken", is still true word for word
-- after a demotion, and the request stays visible in the Queue where the
-- DJ can cue it again.
--
-- queue_position is deliberately left untouched, so a demoted request
-- returns to where it was rather than to the back of the queue.
-- ============================================================

-- ------------------------------------------------------------
-- The invariant itself.
--
-- Partial, so it constrains only the cued row per DJ and says nothing
-- about the many accepted, played or declined rows that share a
-- dj_profile_id. Created concurrently is not used here: this runs in a
-- migration against a table small enough that a brief lock is cheaper
-- than the complexity of a concurrent build that can fail halfway and
-- leave an invalid index behind.
-- ------------------------------------------------------------
create unique index if not exists song_requests_one_playing_next_per_dj_idx
  on public.song_requests (dj_profile_id)
  where request_status = 'playing_next';

comment on index public.song_requests_one_playing_next_per_dj_idx is
  'A DJ has zero or one Playing Next request. Enforced here so no client, '
  'however stale, can cue a second one. set_playing_next() performs the '
  'swap transactionally.';

-- ------------------------------------------------------------
-- Promote one request, demote whatever held the slot, in one statement.
--
-- security definer with search_path pinned, matching reorder_dj_queue()
-- alongside it. Ownership is derived from auth.uid() inside the
-- function: there is no dj_profile_id parameter to forge, and a caller
-- can only ever move their own requests.
--
-- The prior-status requirement is part of the contract, not a
-- convenience. A request must currently be "accepted" to be cued, so a
-- stale tab cannot resurrect a declined, expired or already-played row
-- into the Playing Next slot.
-- ------------------------------------------------------------
create or replace function public.set_playing_next(
  p_request_id uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dj uuid;
begin
  select p.id into v_dj
    from public.dj_profiles p
   where p.user_id = auth.uid()
   order by p.created_at, p.id
   limit 1;

  if v_dj is null then
    raise exception 'no dj profile for caller' using errcode = '42501';
  end if;

  /*
   * Demote first. The unique index means the promotion below would fail
   * outright if the old row were still cued, so the order matters — and
   * because both statements are in one function they are in one
   * transaction, so a second device cannot observe the gap between them
   * or interleave its own swap into it.
   */
  update public.song_requests
     set request_status = 'accepted'
   where dj_profile_id = v_dj
     and request_status = 'playing_next'
     and id <> p_request_id;

  /*
   * Ownership and prior status are both in the WHERE clause, so a
   * request belonging to another DJ, or one that is not currently
   * accepted, simply matches nothing.
   */
  update public.song_requests
     set request_status = 'playing_next'
   where id = p_request_id
     and dj_profile_id = v_dj
     and request_status = 'accepted';

  if not found then
    raise exception 'request is not an accepted request for this dj'
      using errcode = '42501';
  end if;
end;
$$;

comment on function public.set_playing_next(uuid) is
  'Cue one accepted request as Playing Next, returning any previously '
  'cued request to accepted at its existing queue position. One '
  'transaction, so two devices cannot race into two cued requests.';

-- ------------------------------------------------------------
-- EXECUTE grants
--
-- Supabase's default privileges grant EXECUTE on new functions in this
-- schema to anon and authenticated, and "revoke all from public" does
-- NOT remove those: PUBLIC is a different grantee from either role. The
-- revokes below are therefore explicit about anon, or it keeps a grant
-- nobody intended it to have.
--
-- Unlike is_pro_entitled in the bootstrap migration, revoking anon here
-- is safe and correct: this function is SECURITY DEFINER and is called
-- directly by the DJ's browser, never from inside a view, so no other
-- statement depends on a guest being able to execute it. A guest calling
-- it could do nothing anyway — it derives its DJ from auth.uid() — but
-- the grant should still match the intent.
-- ------------------------------------------------------------
revoke all on function public.set_playing_next(uuid) from public;
revoke execute on function public.set_playing_next(uuid) from anon;
grant execute on function public.set_playing_next(uuid) to authenticated;
