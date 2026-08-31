-- ============================================================
-- data_erasures: actually make it append-only
--
-- Why this exists
-- ---------------
-- 20260831_data_erasures.sql granted service_role SELECT and INSERT and
-- said in its own comment: "No UPDATE or DELETE grant, for anyone. An
-- audit record that can be edited or removed is not evidence."
--
-- That comment was false the moment the migration was applied. Verified
-- against Production on 2026-08-31, immediately after applying it:
--
--   service_role UPDATE  ->  200, 0 rows affected   (grant PRESENT)
--   service_role DELETE  ->  200, 0 rows affected   (grant PRESENT)
--
-- Probed against a UUID matching nothing, so the result distinguishes
-- "the grant is missing" (42501) from "the grant is present and nothing
-- matched" (200) without touching a row.
--
-- The cause is the same one that took the guest request page down on
-- 2026-08-28, in the other direction. Supabase's default privileges
-- already grant service_role everything on new tables in this schema, so
-- naming SELECT and INSERT in a GRANT adds nothing and removes nothing.
-- A grant statement describes what is added, never what is withheld.
--
-- The lesson, worth writing down twice: privileges have to be revoked to
-- be absent. Listing the ones you want is not the same as excluding the
-- ones you do not.
--
-- What this changes
-- -----------------
-- Nothing the application does. The erasure API only ever inserts, and
-- the report only ever selects. This closes the gap between what the
-- table promises and what it enforces, so that an erasure record cannot
-- be rewritten or removed by any path, including a mistake in our own
-- admin code.
--
-- Verify after applying, expecting 42501 on both:
--   -- as service_role, against a UUID that matches nothing
--   PATCH  /rest/v1/data_erasures?id=eq.<random-uuid>
--   DELETE /rest/v1/data_erasures?id=eq.<random-uuid>
-- ============================================================

revoke update, delete, truncate on public.data_erasures from service_role;

/* Belt and braces: the same roles the original migration revoked, in
   case a future default privilege re-grants to them. Repeating a revoke
   is harmless; assuming one is not needed is what caused this. */
revoke all on public.data_erasures from public;
revoke all on public.data_erasures from anon;
revoke all on public.data_erasures from authenticated;
