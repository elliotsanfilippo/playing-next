-- =====================================================================
-- reorder_dj_queue: performance measurement
-- Run after the migration. Uses the dj-elliot-test scratch profile,
-- creates its own rows and deletes them. Touches no real data.
-- =====================================================================

delete from public.song_requests where artist = 'perftest';
drop table if exists rpc_perf;
create table rpc_perf(n serial, scenario text, queue_size int, duration_ms numeric, rows_written int);

create or replace function public.perf_seed(p_n int, p_vips int) returns void
language sql as $$
  insert into public.song_requests
    (dj_profile_id, song_title, artist, request_status, stripe_payment_intent_id,
     request_type, is_vip, queue_position, accepted_at, created_at)
  select '91aa987b-9bae-4ba9-a4bd-5d15fa676937', 'p' || g, 'perftest', 'accepted', null,
         'song_request', g <= p_vips, g, now() - ((200 - g) || ' minutes')::interval, now()
    from generate_series(1, p_n) g;
$$;

-- Times the RPC as the scratch DJ and reports how many rows it actually wrote.
create or replace function public.perf_run(p_scenario text, p_size int, p_id uuid, p_dir text)
returns void language plpgsql as $$
declare t0 timestamptz; ms numeric; before_snapshot jsonb; changed int;
begin
  select jsonb_object_agg(id::text, queue_position) into before_snapshot
    from public.song_requests
   where artist = 'perftest' and request_status = 'accepted';

  perform set_config('request.jwt.claims',
    '{"sub":"205ce733-8e4e-4f85-9012-7d5cabf8c706"}', true);
  perform set_config('role', 'authenticated', true);

  t0 := clock_timestamp();
  perform public.reorder_dj_queue(p_id, p_dir);
  ms := extract(epoch from (clock_timestamp() - t0)) * 1000;

  perform set_config('role', 'postgres', true);

  select count(*) into changed
    from public.song_requests s
   where s.artist = 'perftest' and s.request_status = 'accepted'
     and (before_snapshot ->> s.id::text)::int is distinct from s.queue_position;

  insert into rpc_perf(scenario, queue_size, duration_ms, rows_written)
  values (p_scenario, p_size, round(ms, 1), changed);
end $$;

-- full resequence (the accept / decline path) at each size
delete from public.song_requests where artist='perftest';
select public.perf_seed(5, 1);   select public.perf_run('resequence', 5,  null, null);
delete from public.song_requests where artist='perftest';
select public.perf_seed(20, 3);  select public.perf_run('resequence', 20, null, null);
delete from public.song_requests where artist='perftest';
select public.perf_seed(35, 5);  select public.perf_run('resequence', 35, null, null);

-- a single Move Up on a 35-row queue: shows how few rows actually change
select public.perf_run('move up', 35,
  (select id from public.song_requests where artist='perftest' and song_title='p20'), 'up');

-- Move to Top on a 35-row queue
select public.perf_run('move to top', 35,
  (select id from public.song_requests where artist='perftest' and song_title='p30'), 'top');

-- accepting a NEW request into a 35-row queue: the main path we set out to fix
insert into public.song_requests
  (dj_profile_id, song_title, artist, request_status, stripe_payment_intent_id,
   request_type, is_vip, queue_position, accepted_at, created_at)
values ('91aa987b-9bae-4ba9-a4bd-5d15fa676937','pNEW','perftest','accepted',null,
        'song_request',false,null,now(),now());
select public.perf_run('ACCEPT into 35-row queue', 36, null, null);

delete from public.song_requests where artist = 'perftest';
drop function if exists public.perf_seed(int, int);
drop function if exists public.perf_run(text, int, uuid, text);

select n, scenario, queue_size, duration_ms || ' ms' as duration,
       rows_written || ' of ' || queue_size as rows_actually_written,
       1 as client_round_trips
from rpc_perf order by n;
