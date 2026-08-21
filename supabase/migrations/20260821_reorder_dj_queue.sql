-- One atomic reorder instead of N client-side round trips.
--
-- Replaces two client paths:
--   reorderQueue()          a SELECT plus N sequentially awaited UPDATEs,
--                           which ran on every accept, decline, play and
--                           mark-played. Measured at 1561ms for a 35-row
--                           queue, and 1601ms to accept into one.
--   moveAcceptedRequest()   a client-side sort plus Promise.all of N UPDATEs.
--
-- It also fixes a real bug rather than making it atomic. reorderQueue()
-- ordered purely by accepted_at, so a DJ's manual Top/Up/Down was silently
-- discarded the next time any request was accepted. Verified against live
-- data before writing this: C moved to top, a new request accepted, C snapped
-- back to position 3.
--
-- queue_position is now the ordering source of truth. A freshly accepted
-- request has queue_position NULL and therefore joins the end of its own VIP
-- tier, leaving the DJ's manual arrangement of everything above it intact.
--
-- Security model, checked against the live policies:
--   * RLS is ENABLED but not FORCED on song_requests, so a SECURITY DEFINER
--     function owned by the table owner bypasses RLS as intended. The
--     existing "DJs can read/update their own song requests" policies are
--     unchanged and continue to govern all direct table access.
--   * Ownership is derived from auth.uid() inside the function. There is no
--     dj_profile_id parameter to forge.
--   * The function writes queue_position and nothing else, only on rows that
--     belong to the caller and are request_status = 'accepted'.
--   * There are no triggers on song_requests, so the single bulk UPDATE has
--     no side effects.

create or replace function public.reorder_dj_queue(
  p_request_id uuid default null,   -- null = plain resequence (accept/decline path)
  p_direction  text default null    -- 'top' | 'up' | 'down'
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dj     uuid;
  v_is_vip boolean;
begin
  if p_direction is not null and p_direction not in ('top','up','down') then
    raise exception 'invalid direction: %', p_direction using errcode = '22023';
  end if;

  -- Ordered + limited so this can never raise TOO_MANY_ROWS. user_id has no
  -- unique constraint I could confirm, and the app hedges the same way with
  -- .limit(1).maybeSingle().
  select p.id into v_dj
    from public.dj_profiles p
   where p.user_id = auth.uid()
   order by p.created_at, p.id
   limit 1;

  if v_dj is null then
    raise exception 'no dj profile for caller' using errcode = '42501';
  end if;

  -- Serialise concurrent reorders for this DJ so two moves cannot interleave
  -- and produce duplicate positions.
  perform 1 from public.song_requests
    where dj_profile_id = v_dj and request_status = 'accepted'
    for update;

  if p_request_id is not null then
    select s.is_vip into v_is_vip
      from public.song_requests s
     where s.id = p_request_id
       and s.dj_profile_id  = v_dj          -- ownership
       and s.request_status = 'accepted';   -- and actually in the queue

    if not found then
      raise exception 'request not in your accepted queue' using errcode = '42501';
    end if;
  end if;

  with ordered as (
    select id, is_vip,
           row_number() over (
             partition by is_vip
             order by coalesce(queue_position, 2147483647), accepted_at, id
           ) as tier_rank
      from public.song_requests
     where dj_profile_id = v_dj and request_status = 'accepted'
  ),
  moved as (
    -- +/- 1.5 slots the moved row cleanly between its neighbours. At a tier
    -- boundary it lands outside the range and the row simply stays put, so
    -- first-moving-up and last-moving-down are no-ops rather than errors.
    select id, is_vip,
           case
             when p_request_id is null
               or is_vip is distinct from v_is_vip then tier_rank::numeric
             when id = p_request_id and p_direction = 'top'  then 0
             when id = p_request_id and p_direction = 'up'   then tier_rank - 1.5
             when id = p_request_id and p_direction = 'down' then tier_rank + 1.5
             else tier_rank::numeric
           end as sort_key
      from ordered
  ),
  final as (
    select id, row_number() over (order by is_vip desc, sort_key, id) as pos
      from moved
  )
  update public.song_requests s
     set queue_position = f.pos
    from final f
   where s.id = f.id
     and s.dj_profile_id  = v_dj
     and s.request_status = 'accepted'
     and s.queue_position is distinct from f.pos;  -- unchanged rows emit no realtime event
end $$;

revoke all     on function public.reorder_dj_queue(uuid, text) from public, anon;
grant  execute on function public.reorder_dj_queue(uuid, text) to authenticated;
