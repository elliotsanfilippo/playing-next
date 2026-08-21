-- =====================================================================
-- reorder_dj_queue: performance measurement
--
-- Run after the migration. Uses the dj-elliot-test scratch profile,
-- creates its own rows and deletes them. Touches no real data.
--
-- Every table reference is schema-qualified on purpose.
-- reorder_dj_queue is defined with SET search_path = '', which applies
-- for the duration of each call. Anything unqualified in this script
-- that runs after one of those calls cannot be resolved, which is what
-- produced 42P01 relation "rpc_snap" does not exist. Qualifying costs
-- nothing and removes the whole class of failure.
-- =====================================================================

drop table if exists public.rpc_perf;
create table public.rpc_perf(
  n           serial,
  scenario    text,
  queue_size  int,
  ms          numeric,
  rows_written int
);

drop table if exists public.rpc_snap;
create table public.rpc_snap(id uuid primary key, pos int);

do $$
declare
  v_dj    uuid := '91aa987b-9bae-4ba9-a4bd-5d15fa676937';
  v_claim text := '{"sub":"205ce733-8e4e-4f85-9012-7d5cabf8c706"}';
  v_sizes int[] := array[5, 20, 35];
  v_n     int;
  v_t0    timestamptz;
  v_ms    numeric;
  v_rows  int;
  v_id    uuid;
begin
  perform set_config('request.jwt.claims', v_claim, true);

  -- ---------- full resequence: the accept / decline path ----------
  foreach v_n in array v_sizes loop
    delete from public.song_requests where artist = 'perftest';

    insert into public.song_requests
      (dj_profile_id, song_title, artist, request_status,
       stripe_payment_intent_id, request_type, is_vip,
       queue_position, accepted_at, created_at)
    select v_dj, 'p' || g, 'perftest', 'accepted', null, 'song_request',
           g <= 3, g, now() - (g * interval '1 minute'), now()
      from generate_series(1, v_n) g;

    delete from public.rpc_snap;
    insert into public.rpc_snap select id, queue_position
      from public.song_requests where artist = 'perftest';

    perform set_config('role', 'authenticated', true);
    v_t0 := clock_timestamp();
    perform public.reorder_dj_queue(null, null);
    v_ms := extract(epoch from (clock_timestamp() - v_t0)) * 1000;
    perform set_config('role', 'postgres', true);

    select count(*) into v_rows
      from public.song_requests s join public.rpc_snap k on k.id = s.id
     where s.queue_position is distinct from k.pos;

    insert into public.rpc_perf(scenario, queue_size, ms, rows_written)
    values ('resequence', v_n, round(v_ms, 1), v_rows);
  end loop;

  -- ---------- a single Move Up on the 35-row queue ----------
  delete from public.rpc_snap;
  insert into public.rpc_snap select id, queue_position
    from public.song_requests where artist = 'perftest';

  select id into v_id from public.song_requests
   where artist = 'perftest' and song_title = 'p20';

  perform set_config('role', 'authenticated', true);
  v_t0 := clock_timestamp();
  perform public.reorder_dj_queue(v_id, 'up');
  v_ms := extract(epoch from (clock_timestamp() - v_t0)) * 1000;
  perform set_config('role', 'postgres', true);

  select count(*) into v_rows
    from public.song_requests s join public.rpc_snap k on k.id = s.id
   where s.queue_position is distinct from k.pos;

  insert into public.rpc_perf(scenario, queue_size, ms, rows_written)
  values ('move up', 35, round(v_ms, 1), v_rows);

  -- ---------- Move to Top on the 35-row queue ----------
  delete from public.rpc_snap;
  insert into public.rpc_snap select id, queue_position
    from public.song_requests where artist = 'perftest';

  select id into v_id from public.song_requests
   where artist = 'perftest' and song_title = 'p30';

  perform set_config('role', 'authenticated', true);
  v_t0 := clock_timestamp();
  perform public.reorder_dj_queue(v_id, 'top');
  v_ms := extract(epoch from (clock_timestamp() - v_t0)) * 1000;
  perform set_config('role', 'postgres', true);

  select count(*) into v_rows
    from public.song_requests s join public.rpc_snap k on k.id = s.id
   where s.queue_position is distinct from k.pos;

  insert into public.rpc_perf(scenario, queue_size, ms, rows_written)
  values ('move to top', 35, round(v_ms, 1), v_rows);

  -- ---------- accepting a NEW request into a 35-row queue ----------
  -- This is the path that measured 1601ms before.
  insert into public.song_requests
    (dj_profile_id, song_title, artist, request_status,
     stripe_payment_intent_id, request_type, is_vip,
     queue_position, accepted_at, created_at)
  values (v_dj, 'pNEW', 'perftest', 'accepted', null, 'song_request',
          false, null, now(), now());

  delete from public.rpc_snap;
  insert into public.rpc_snap select id, queue_position
    from public.song_requests where artist = 'perftest';

  perform set_config('role', 'authenticated', true);
  v_t0 := clock_timestamp();
  perform public.reorder_dj_queue(null, null);
  v_ms := extract(epoch from (clock_timestamp() - v_t0)) * 1000;
  perform set_config('role', 'postgres', true);

  select count(*) into v_rows
    from public.song_requests s join public.rpc_snap k on k.id = s.id
   where s.queue_position is distinct from k.pos;

  insert into public.rpc_perf(scenario, queue_size, ms, rows_written)
  values ('ACCEPT into 35-row queue', 36, round(v_ms, 1), v_rows);

  delete from public.song_requests where artist = 'perftest';
end $$;

drop table if exists public.rpc_snap;

select n,
       scenario,
       queue_size,
       ms || ' ms'                                as duration,
       rows_written || ' of ' || queue_size       as rows_actually_written,
       1                                          as client_round_trips
from public.rpc_perf
order by n;

-- =====================================================================
-- FALLBACK, if the block above still will not run.
-- Four trivial statements. Run them one at a time; the last one prints
-- the server-side execution time directly.
--
--   1. insert into public.song_requests
--        (dj_profile_id, song_title, artist, request_status,
--         stripe_payment_intent_id, request_type, is_vip,
--         queue_position, accepted_at, created_at)
--      select '91aa987b-9bae-4ba9-a4bd-5d15fa676937', 'p' || g, 'perftest',
--             'accepted', null, 'song_request', g <= 3, g,
--             now() - (g * interval '1 minute'), now()
--        from generate_series(1, 35) g;
--
--   2. select set_config('request.jwt.claims',
--        '{"sub":"205ce733-8e4e-4f85-9012-7d5cabf8c706"}', false);
--
--   3. select set_config('role', 'authenticated', false);
--
--   4. explain analyze select public.reorder_dj_queue();
--         -> read "Execution Time" at the bottom
--
--   then: reset role;
--         delete from public.song_requests where artist = 'perftest';
-- =====================================================================
