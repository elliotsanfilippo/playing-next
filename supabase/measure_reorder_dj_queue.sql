-- =====================================================================
-- reorder_dj_queue: performance measurement
--
-- Run after the migration. Uses the dj-elliot-test scratch profile,
-- creates its own rows and deletes them. Touches no real data.
--
-- Deliberately one DO block with no helper functions: the previous
-- version used SQL/plpgsql helpers and a jsonb snapshot and failed to
-- parse, so everything exotic is gone.
-- =====================================================================

drop table if exists rpc_perf;
create table rpc_perf(
  n           serial,
  scenario    text,
  queue_size  int,
  ms          numeric,
  rows_written int
);

drop table if exists rpc_snap;
create table rpc_snap(id uuid primary key, pos int);

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

    delete from rpc_snap;
    insert into rpc_snap select id, queue_position
      from public.song_requests where artist = 'perftest';

    perform set_config('role', 'authenticated', true);
    v_t0 := clock_timestamp();
    perform public.reorder_dj_queue(null, null);
    v_ms := extract(epoch from (clock_timestamp() - v_t0)) * 1000;
    perform set_config('role', 'postgres', true);

    select count(*) into v_rows
      from public.song_requests s join rpc_snap k on k.id = s.id
     where s.queue_position is distinct from k.pos;

    insert into rpc_perf(scenario, queue_size, ms, rows_written)
    values ('resequence', v_n, round(v_ms, 1), v_rows);
  end loop;

  -- ---------- a single Move Up on the 35-row queue ----------
  delete from rpc_snap;
  insert into rpc_snap select id, queue_position
    from public.song_requests where artist = 'perftest';

  select id into v_id from public.song_requests
   where artist = 'perftest' and song_title = 'p20';

  perform set_config('role', 'authenticated', true);
  v_t0 := clock_timestamp();
  perform public.reorder_dj_queue(v_id, 'up');
  v_ms := extract(epoch from (clock_timestamp() - v_t0)) * 1000;
  perform set_config('role', 'postgres', true);

  select count(*) into v_rows
    from public.song_requests s join rpc_snap k on k.id = s.id
   where s.queue_position is distinct from k.pos;

  insert into rpc_perf(scenario, queue_size, ms, rows_written)
  values ('move up', 35, round(v_ms, 1), v_rows);

  -- ---------- Move to Top on the 35-row queue ----------
  delete from rpc_snap;
  insert into rpc_snap select id, queue_position
    from public.song_requests where artist = 'perftest';

  select id into v_id from public.song_requests
   where artist = 'perftest' and song_title = 'p30';

  perform set_config('role', 'authenticated', true);
  v_t0 := clock_timestamp();
  perform public.reorder_dj_queue(v_id, 'top');
  v_ms := extract(epoch from (clock_timestamp() - v_t0)) * 1000;
  perform set_config('role', 'postgres', true);

  select count(*) into v_rows
    from public.song_requests s join rpc_snap k on k.id = s.id
   where s.queue_position is distinct from k.pos;

  insert into rpc_perf(scenario, queue_size, ms, rows_written)
  values ('move to top', 35, round(v_ms, 1), v_rows);

  -- ---------- accepting a NEW request into a 35-row queue ----------
  -- This is the path that measured 1601ms before.
  insert into public.song_requests
    (dj_profile_id, song_title, artist, request_status,
     stripe_payment_intent_id, request_type, is_vip,
     queue_position, accepted_at, created_at)
  values (v_dj, 'pNEW', 'perftest', 'accepted', null, 'song_request',
          false, null, now(), now());

  delete from rpc_snap;
  insert into rpc_snap select id, queue_position
    from public.song_requests where artist = 'perftest';

  perform set_config('role', 'authenticated', true);
  v_t0 := clock_timestamp();
  perform public.reorder_dj_queue(null, null);
  v_ms := extract(epoch from (clock_timestamp() - v_t0)) * 1000;
  perform set_config('role', 'postgres', true);

  select count(*) into v_rows
    from public.song_requests s join rpc_snap k on k.id = s.id
   where s.queue_position is distinct from k.pos;

  insert into rpc_perf(scenario, queue_size, ms, rows_written)
  values ('ACCEPT into 35-row queue', 36, round(v_ms, 1), v_rows);

  delete from public.song_requests where artist = 'perftest';
end $$;

drop table if exists rpc_snap;

select n,
       scenario,
       queue_size,
       ms || ' ms'                                as duration,
       rows_written || ' of ' || queue_size       as rows_actually_written,
       1                                          as client_round_trips
from rpc_perf
order by n;
