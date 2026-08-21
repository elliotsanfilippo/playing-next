-- =====================================================================
-- reorder_dj_queue: invariant + security suite
--
-- STATUS: passed 28/28 on 2026-08-21 against the dj-elliot-test scratch
-- profile. Kept as the record of how the RPC's ordering and security
-- guarantees were verified, and as the suite to re-run if the function
-- or the queue rules ever change.
--
-- A companion measurement script existed briefly and was deleted: it
-- never ran successfully in the SQL editor and Task B was closed on the
-- functional evidence instead. Performance is covered by the before
-- figures in the Perf B commit message.
--
-- Run AFTER applying 20260821_reorder_dj_queue.sql.
-- Uses the dj-elliot-test scratch profile, creates its own rows, and
-- deletes them at the end. Touches no real DJ's data.
--
-- Deliberately flat: one statement per test, so if anything fails you
-- can see exactly which line did.
--
-- The last statement returns the results table. Every row must say PASS.
-- =====================================================================

delete from public.song_requests where artist = 'rpctest';
drop table if exists rpc_results;
create table rpc_results(n serial, test text, expected text, actual text);

-- Calls the RPC as a given auth user, returning 'ok' or the SQLSTATE.
create or replace function public.rpctest_as(p_usr uuid, p_id uuid, p_dir text)
returns text language plpgsql as $$
declare m text;
begin
  if p_usr is null then
    perform set_config('request.jwt.claims', '', true);
  else
    perform set_config('request.jwt.claims', json_build_object('sub', p_usr)::text, true);
  end if;
  perform set_config('role', 'authenticated', true);
  begin
    perform public.reorder_dj_queue(p_id, p_dir);
    m := 'ok';
  exception when others then
    m := sqlstate;
  end;
  perform set_config('role', 'postgres', true);
  return m;
end $$;

-- Queue as "A* B C" (asterisk = VIP), plus the two invariants.
create or replace function public.rpctest_state(p_dj uuid)
returns text language sql as $$
  select coalesce(
      (select string_agg(song_title || case when is_vip then '*' else '' end, ' '
                         order by queue_position)
         from public.song_requests
        where dj_profile_id = p_dj and request_status = 'accepted'), '(empty)')
    || '|dense=' ||
      (select coalesce(bool_and(queue_position = rn), true)
         from (select queue_position, row_number() over (order by queue_position) rn
                 from public.song_requests
                where dj_profile_id = p_dj and request_status = 'accepted') x)
    || '|vip=' ||
      (select coalesce(max(case when is_vip then queue_position end)
                     < min(case when not is_vip then queue_position end), true)
         from public.song_requests
        where dj_profile_id = p_dj and request_status = 'accepted');
$$;

create or replace function public.rpctest_seed(p_dj uuid, p_n int, p_vips int)
returns void language sql as $$
  insert into public.song_requests
    (dj_profile_id, song_title, artist, request_status, stripe_payment_intent_id,
     request_type, is_vip, queue_position, accepted_at, created_at)
  select p_dj, chr(64 + g), 'rpctest', 'accepted', null, 'song_request',
         g <= p_vips, g, now() - ((100 - g) || ' minutes')::interval, now()
    from generate_series(1, p_n) g;
$$;

-- ============================ 1. sizes ============================
insert into rpc_results(test, expected, actual) select 'empty queue', 'ok|(empty)|dense=true|vip=true',
  public.rpctest_as('205ce733-8e4e-4f85-9012-7d5cabf8c706', null, null) || '|' ||
  public.rpctest_state('91aa987b-9bae-4ba9-a4bd-5d15fa676937');

delete from public.song_requests where artist='rpctest';
select public.rpctest_seed('91aa987b-9bae-4ba9-a4bd-5d15fa676937', 1, 0);
insert into rpc_results(test, expected, actual) select '1 request', 'ok|A|dense=true|vip=true',
  public.rpctest_as('205ce733-8e4e-4f85-9012-7d5cabf8c706', null, null) || '|' ||
  public.rpctest_state('91aa987b-9bae-4ba9-a4bd-5d15fa676937');

delete from public.song_requests where artist='rpctest';
select public.rpctest_seed('91aa987b-9bae-4ba9-a4bd-5d15fa676937', 5, 0);
insert into rpc_results(test, expected, actual) select '5 requests, all standard', 'ok|A B C D E|dense=true|vip=true',
  public.rpctest_as('205ce733-8e4e-4f85-9012-7d5cabf8c706', null, null) || '|' ||
  public.rpctest_state('91aa987b-9bae-4ba9-a4bd-5d15fa676937');

delete from public.song_requests where artist='rpctest';
select public.rpctest_seed('91aa987b-9bae-4ba9-a4bd-5d15fa676937', 20, 0);
insert into rpc_results(test, expected, actual) select '20 requests', 'ok|dense=true|vip=true',
  public.rpctest_as('205ce733-8e4e-4f85-9012-7d5cabf8c706', null, null) || '|' ||
  split_part(public.rpctest_state('91aa987b-9bae-4ba9-a4bd-5d15fa676937'), '|', 2) || '|' ||
  split_part(public.rpctest_state('91aa987b-9bae-4ba9-a4bd-5d15fa676937'), '|', 3);

delete from public.song_requests where artist='rpctest';
select public.rpctest_seed('91aa987b-9bae-4ba9-a4bd-5d15fa676937', 35, 5);
insert into rpc_results(test, expected, actual) select '35 requests, mixed', 'ok|dense=true|vip=true',
  public.rpctest_as('205ce733-8e4e-4f85-9012-7d5cabf8c706', null, null) || '|' ||
  split_part(public.rpctest_state('91aa987b-9bae-4ba9-a4bd-5d15fa676937'), '|', 2) || '|' ||
  split_part(public.rpctest_state('91aa987b-9bae-4ba9-a4bd-5d15fa676937'), '|', 3);

-- ========================= 2. composition =========================
delete from public.song_requests where artist='rpctest';
select public.rpctest_seed('91aa987b-9bae-4ba9-a4bd-5d15fa676937', 5, 5);
insert into rpc_results(test, expected, actual) select 'all VIP', 'ok|A* B* C* D* E*|dense=true|vip=true',
  public.rpctest_as('205ce733-8e4e-4f85-9012-7d5cabf8c706', null, null) || '|' ||
  public.rpctest_state('91aa987b-9bae-4ba9-a4bd-5d15fa676937');

delete from public.song_requests where artist='rpctest';
select public.rpctest_seed('91aa987b-9bae-4ba9-a4bd-5d15fa676937', 5, 2);
insert into rpc_results(test, expected, actual) select 'mixed VIP/standard', 'ok|A* B* C D E|dense=true|vip=true',
  public.rpctest_as('205ce733-8e4e-4f85-9012-7d5cabf8c706', null, null) || '|' ||
  public.rpctest_state('91aa987b-9bae-4ba9-a4bd-5d15fa676937');

-- ===================== 3. moves and boundaries =====================
select public.rpctest_as('205ce733-8e4e-4f85-9012-7d5cabf8c706',
  (select id from public.song_requests where artist='rpctest' and song_title='E'), 'top');
insert into rpc_results(test, expected, actual) select 'move E to top of its tier', 'A* B* E C D|dense=true|vip=true',
  public.rpctest_state('91aa987b-9bae-4ba9-a4bd-5d15fa676937');

select public.rpctest_as('205ce733-8e4e-4f85-9012-7d5cabf8c706',
  (select id from public.song_requests where artist='rpctest' and song_title='D'), 'up');
insert into rpc_results(test, expected, actual) select 'move D up', 'A* B* E D C|dense=true|vip=true',
  public.rpctest_state('91aa987b-9bae-4ba9-a4bd-5d15fa676937');

select public.rpctest_as('205ce733-8e4e-4f85-9012-7d5cabf8c706',
  (select id from public.song_requests where artist='rpctest' and song_title='D'), 'down');
insert into rpc_results(test, expected, actual) select 'move D down', 'A* B* E C D|dense=true|vip=true',
  public.rpctest_state('91aa987b-9bae-4ba9-a4bd-5d15fa676937');

select public.rpctest_as('205ce733-8e4e-4f85-9012-7d5cabf8c706',
  (select id from public.song_requests where artist='rpctest' and song_title='E'), 'up');
insert into rpc_results(test, expected, actual) select 'first in tier moves up (no-op)', 'A* B* E C D|dense=true|vip=true',
  public.rpctest_state('91aa987b-9bae-4ba9-a4bd-5d15fa676937');

select public.rpctest_as('205ce733-8e4e-4f85-9012-7d5cabf8c706',
  (select id from public.song_requests where artist='rpctest' and song_title='D'), 'down');
insert into rpc_results(test, expected, actual) select 'last in tier moves down (no-op)', 'A* B* E C D|dense=true|vip=true',
  public.rpctest_state('91aa987b-9bae-4ba9-a4bd-5d15fa676937');

select public.rpctest_as('205ce733-8e4e-4f85-9012-7d5cabf8c706',
  (select id from public.song_requests where artist='rpctest' and song_title='C'), 'top');
insert into rpc_results(test, expected, actual) select 'standard to top cannot pass VIP', 'A* B* C E D|dense=true|vip=true',
  public.rpctest_state('91aa987b-9bae-4ba9-a4bd-5d15fa676937');

select public.rpctest_as('205ce733-8e4e-4f85-9012-7d5cabf8c706',
  (select id from public.song_requests where artist='rpctest' and song_title='B'), 'up');
insert into rpc_results(test, expected, actual) select 'VIP move stays within VIP tier', 'B* A* C E D|dense=true|vip=true',
  public.rpctest_state('91aa987b-9bae-4ba9-a4bd-5d15fa676937');

-- ============ 4. manual order survives later accepts (Option 2) ============
insert into public.song_requests
  (dj_profile_id, song_title, artist, request_status, stripe_payment_intent_id,
   request_type, is_vip, queue_position, accepted_at, created_at)
values ('91aa987b-9bae-4ba9-a4bd-5d15fa676937','NEWSTD','rpctest','accepted',null,'song_request',false,null,now(),now());
select public.rpctest_as('205ce733-8e4e-4f85-9012-7d5cabf8c706', null, null);
insert into rpc_results(test, expected, actual) select 'accept STANDARD after manual reorder', 'B* A* C E D NEWSTD|dense=true|vip=true',
  public.rpctest_state('91aa987b-9bae-4ba9-a4bd-5d15fa676937');

insert into public.song_requests
  (dj_profile_id, song_title, artist, request_status, stripe_payment_intent_id,
   request_type, is_vip, queue_position, accepted_at, created_at)
values ('91aa987b-9bae-4ba9-a4bd-5d15fa676937','NEWVIP','rpctest','accepted',null,'song_request',true,null,now(),now());
select public.rpctest_as('205ce733-8e4e-4f85-9012-7d5cabf8c706', null, null);
insert into rpc_results(test, expected, actual) select 'accept VIP after manual reorder', 'B* A* NEWVIP* C E D NEWSTD|dense=true|vip=true',
  public.rpctest_state('91aa987b-9bae-4ba9-a4bd-5d15fa676937');

-- ==================== 5. status transitions ====================
update public.song_requests set request_status='playing_next' where artist='rpctest' and song_title='C';
select public.rpctest_as('205ce733-8e4e-4f85-9012-7d5cabf8c706', null, null);
insert into rpc_results(test, expected, actual) select 'playing_next leaves the queue', 'B* A* NEWVIP* E D NEWSTD|dense=true|vip=true',
  public.rpctest_state('91aa987b-9bae-4ba9-a4bd-5d15fa676937');

update public.song_requests set request_status='played' where artist='rpctest' and song_title='E';
select public.rpctest_as('205ce733-8e4e-4f85-9012-7d5cabf8c706', null, null);
insert into rpc_results(test, expected, actual) select 'played leaves the queue', 'B* A* NEWVIP* D NEWSTD|dense=true|vip=true',
  public.rpctest_state('91aa987b-9bae-4ba9-a4bd-5d15fa676937');

update public.song_requests set request_status='declined' where artist='rpctest' and song_title='D';
select public.rpctest_as('205ce733-8e4e-4f85-9012-7d5cabf8c706', null, null);
insert into rpc_results(test, expected, actual) select 'declined leaves the queue', 'B* A* NEWVIP* NEWSTD|dense=true|vip=true',
  public.rpctest_state('91aa987b-9bae-4ba9-a4bd-5d15fa676937');

-- ========================= 6. security =========================
insert into rpc_results(test, expected, actual) select 'another DJ''s request id rejected', '42501',
  public.rpctest_as('205ce733-8e4e-4f85-9012-7d5cabf8c706',
    (select id from public.song_requests
      where dj_profile_id='005add10-6c34-4637-9ccf-163d389fcd6d'
        and request_status='accepted' limit 1), 'top');

insert into rpc_results(test, expected, actual) select 'no cross-DJ mutation', 'true',
  (select coalesce(bool_and(queue_position is not null), true)::text
     from public.song_requests
    where dj_profile_id='005add10-6c34-4637-9ccf-163d389fcd6d' and request_status='accepted');

insert into rpc_results(test, expected, actual) select 'non-existent request id rejected', '42501',
  public.rpctest_as('205ce733-8e4e-4f85-9012-7d5cabf8c706','00000000-0000-0000-0000-000000000000','up');

insert into rpc_results(test, expected, actual) select 'invalid direction rejected', '22023',
  public.rpctest_as('205ce733-8e4e-4f85-9012-7d5cabf8c706', null, 'sideways');

insert into rpc_results(test, expected, actual) select 'unauthenticated call rejected', '42501',
  public.rpctest_as(null, null, null);

-- ==================== 7. grants and definition ====================
insert into rpc_results(test, expected, actual) select 'anon cannot execute', 'false',
  has_function_privilege('anon','public.reorder_dj_queue(uuid,text)','EXECUTE')::text;

-- PUBLIC is not a real role, so has_function_privilege() errors on it.
-- Inspect the ACL instead, one aclitem at a time.
--
-- An aclitem renders as  grantee=privileges/grantor. A PUBLIC grant has
-- an EMPTY grantee ("=X/postgres"); a role grant does not
-- ("authenticated=X/postgres"). An earlier version of this test used
-- LIKE '%=X/%' against the whole ACL joined into one string, which also
-- matched "authenticated=X/postgres" and so reported a PUBLIC grant that
-- does not exist.
--
-- NULL proacl would mean default privileges, and the default for a
-- function IS execute to PUBLIC, so that case must count as a failure too.
insert into rpc_results(test, expected, actual)
select 'PUBLIC not in the ACL', 'true',
  (p.proacl is not null
   and not exists (
     select 1 from unnest(p.proacl) a
      where split_part(a::text, '=', 1) = ''
   ))::text
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname='public' and p.proname='reorder_dj_queue';

insert into rpc_results(test, expected, actual) select 'authenticated can execute', 'true',
  has_function_privilege('authenticated','public.reorder_dj_queue(uuid,text)','EXECUTE')::text;

-- proconfig stores SET search_path = '' as search_path="" — the empty
-- value is rendered as two quote characters, not as nothing. Quotes are
-- stripped so either representation compares equal.
insert into rpc_results(test, expected, actual)
select 'security definer + empty search_path', 'true|search_path=',
       p.prosecdef::text || '|' ||
       replace(coalesce(array_to_string(p.proconfig, ','), 'NONE'), '"', '')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname='public' and p.proname='reorder_dj_queue';

-- ---------------- diagnostics (informational, always shown) ----------------
insert into rpc_results(test, expected, actual)
select 'info: raw proacl', '(see actual)',
       coalesce(array_to_string(p.proacl, '  |  '), 'NULL (defaults apply)')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname='public' and p.proname='reorder_dj_queue';

insert into rpc_results(test, expected, actual)
select 'info: raw proconfig', '(see actual)',
       coalesce(array_to_string(p.proconfig, ','), 'NONE')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname='public' and p.proname='reorder_dj_queue';

insert into rpc_results(test, expected, actual)
select 'info: effective EXECUTE by role', '(see actual)',
       'anon='         || has_function_privilege('anon',         'public.reorder_dj_queue(uuid,text)','EXECUTE')::text ||
       ' authenticated='|| has_function_privilege('authenticated','public.reorder_dj_queue(uuid,text)','EXECUTE')::text ||
       ' service_role=' || has_function_privilege('service_role', 'public.reorder_dj_queue(uuid,text)','EXECUTE')::text;

-- ============================ cleanup ============================
delete from public.song_requests where artist = 'rpctest';
drop function if exists public.rpctest_as(uuid, uuid, text);
drop function if exists public.rpctest_state(uuid);
drop function if exists public.rpctest_seed(uuid, int, int);

select n, test, expected, actual,
       case when test like 'info:%' then 'INFO'
            when expected = actual then 'PASS'
            else '*** FAIL ***' end as result
from rpc_results order by n;
