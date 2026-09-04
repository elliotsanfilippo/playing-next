-- ============================================================
-- erase_personal_fields: the one function without a fixed search_path
--
-- NOT APPLIED TO PRODUCTION. Written 2026-09-04, verified against
-- Playing Next Test first.
--
-- Why
-- ---
-- Every other function in the public schema pins search_path to the
-- empty string. Counted rather than assumed: 11 of 12 carry
-- search_path="" and this is the only exception, so the project's
-- posture is not a preference for SECURITY DEFINER functions, it is the
-- rule, and this function simply predates it being applied consistently.
--
--   set_playing_next                          DEFINER  search_path=""
--   reorder_dj_queue                          DEFINER  search_path=""
--   crm_touch_updated_at                      INVOKER  search_path=""
--   delivery_state_rank                       INVOKER  search_path=""
--   dj_lifecycle_emails_delivery_forward_only INVOKER  search_path=""
--   dj_lifecycle_emails_return_is_final       INVOKER  search_path=""
--   dj_lifecycle_emails_sent_is_final         INVOKER  search_path=""
--   dj_profiles_stamp_lifecycle               INVOKER  search_path=""
--   dj_profiles_stamp_profile_completed       INVOKER  search_path=""
--   is_pro_entitled                           INVOKER  search_path=""
--   is_profile_complete                       INVOKER  search_path=""
--   erase_personal_fields                     INVOKER  (none)   <- this
--
-- The exposure here is smaller than the linter's wording suggests: the
-- function is SECURITY INVOKER, so it runs with the caller's privileges
-- and cannot be used to borrow anyone else's, and only service_role
-- calls it. It is still worth closing, because a mutable search_path
-- means an unqualified name inside the body resolves against whatever
-- the caller happens to have set. This is the function that clears
-- personal data and writes the audit row proving it; "which table did
-- that actually touch" should never have a caller-dependent answer.
--
-- Why ALTER rather than CREATE OR REPLACE
-- ---------------------------------------
-- The body does not change, so it should not be retyped. Restating a
-- 100-line function to add one setting risks a transcription error in
-- exactly the code whose correctness matters most, and would make the
-- diff look like a rewrite of the erasure logic rather than a one-line
-- hardening. ALTER FUNCTION changes the setting and nothing else.
--
-- Safe because the body is already fully qualified
-- ------------------------------------------------
-- An empty search_path breaks a function that relies on unqualified
-- names. This one does not. Every table it touches is written out in
-- full: public.song_requests, public.tips, public.not_played_reports,
-- public.qr_box_orders and public.data_erasures. The only other names
-- in the body are length, trim, coalesce, nullif, array_remove and
-- array_length, which live in pg_catalog and are resolved from there
-- whatever search_path says.
--
-- The signature is spelled out in full because the name alone is
-- ambiguous to ALTER FUNCTION if an overload is ever added.
-- ============================================================

alter function public.erase_personal_fields(
  p_object_type text,
  p_object_id uuid,
  p_classification text,
  p_performed_by text,
  p_request_reference text
) set search_path = '';

comment on function public.erase_personal_fields(text, uuid, text, text, text) is
  'Clears the personal fields of one record and writes its data_erasures '
  'row in the same transaction. SECURITY INVOKER with search_path pinned '
  'empty, matching every other function in this schema; the body is '
  'fully schema-qualified, so nothing it touches depends on the '
  'caller''s search_path.';
