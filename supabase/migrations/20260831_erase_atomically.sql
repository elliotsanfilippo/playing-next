-- ============================================================
-- erase_personal_fields: the clear and the audit, or neither
--
-- The problem this fixes
-- ----------------------
-- The erasure route wrote the immutable data_erasures record first and
-- then cleared the source field. A failure between the two leaves an
-- audit record asserting an erasure that never happened - and because
-- data_erasures is append-only by design, that false record can never be
-- corrected or removed.
--
-- Writing the audit second is not better, it is worse in the other
-- direction: the personal data would be gone with no evidence it was
-- erased or by whom.
--
-- Neither order is safe, because the problem is not the order. Two
-- statements that must both happen have to be one transaction.
--
-- Why a function
-- --------------
-- PostgREST cannot span two tables in one client-side transaction. A
-- plpgsql function body IS a single transaction: every statement in here
-- commits together or rolls back together. Raising an exception anywhere
-- below discards the audit insert along with everything else.
--
-- SECURITY INVOKER, deliberately - the default, stated here so nobody
-- "fixes" it later. service_role already holds INSERT on data_erasures
-- and UPDATE on the source tables, so no elevation is needed. Making it
-- SECURITY DEFINER would grant the caller the owner's rights, including
-- UPDATE and DELETE on data_erasures, which is exactly the append-only
-- guarantee we just spent a migration establishing.
--
-- No dynamic SQL
-- --------------
-- Field names arrive from the caller nowhere. Each object type has a
-- fixed, literal column list, so there is nothing to inject into. The
-- caller chooses WHICH KIND of record, never which columns.
--
-- The eligibility rules live here too, not only in the API. A paid QR
-- box order cannot have its address cleared by any caller, including a
-- future bug in our own admin code.
-- ============================================================

create or replace function public.erase_personal_fields(
  p_object_type       text,
  p_object_id         uuid,
  p_classification    text,
  p_performed_by      text,
  p_request_reference text default null
)
returns table (fields_cleared text[])
language plpgsql
as $$
declare
  v_fields text[] := '{}';
  v_count  int := 0;
begin
  if p_performed_by is null or length(trim(p_performed_by)) = 0 then
    raise exception 'performed_by is required'
      using errcode = 'check_violation';
  end if;

  if p_object_type = 'song_request' then
    /* Only rows that actually hold something. A no-op update would
       otherwise produce an audit record for an erasure that erased
       nothing. */
    update public.song_requests
       set message = null
     where id = p_object_id
       and message is not null
       and length(trim(message)) > 0;
    get diagnostics v_count = row_count;
    if v_count = 1 then v_fields := array['message']; end if;

  elsif p_object_type = 'tip' then
    update public.tips
       set message = null
     where id = p_object_id
       and message is not null
       and length(trim(message)) > 0;
    get diagnostics v_count = row_count;
    if v_count = 1 then v_fields := array['message']; end if;

  elsif p_object_type = 'not_played_report' then
    /* The report row and its outcome are preserved; only the guest's
       free text goes. */
    update public.not_played_reports
       set reason = null
     where id = p_object_id
       and reason is not null
       and length(trim(reason)) > 0;
    get diagnostics v_count = row_count;
    if v_count = 1 then v_fields := array['reason']; end if;

  elsif p_object_type = 'qr_box_order' then
    /*
     * Which address fields held something, captured BEFORE the update so
     * the audit lists what was really cleared rather than all six every
     * time. Setting an already-null column to null is a no-op, so the
     * update itself can name them all.
     *
     * The status and payment guards are the same refusal the API makes,
     * repeated here because a database that only trusts its callers is
     * one bug away from clearing a live delivery address.
     */
    select array_remove(array[
             case when nullif(trim(coalesce(recipient_name,'')), '') is not null then 'recipient_name' end,
             case when nullif(trim(coalesce(address_line1,'')), '') is not null then 'address_line1' end,
             case when nullif(trim(coalesce(address_line2,'')), '') is not null then 'address_line2' end,
             case when nullif(trim(coalesce(city,'')), '') is not null then 'city' end,
             case when nullif(trim(coalesce(postcode,'')), '') is not null then 'postcode' end,
             case when nullif(trim(coalesce(country,'')), '') is not null then 'country' end
           ], null)
      into v_fields
      from public.qr_box_orders
     where id = p_object_id
       and status = 'pending_payment'
       and stripe_payment_intent_id is null;

    if v_fields is null or array_length(v_fields, 1) is null then
      v_fields := '{}';
    else
      update public.qr_box_orders
         set recipient_name = null,
             address_line1  = null,
             address_line2  = null,
             city           = null,
             postcode       = null,
             country        = null
       where id = p_object_id
         and status = 'pending_payment'
         and stripe_payment_intent_id is null;
      get diagnostics v_count = row_count;
      if v_count <> 1 then v_fields := '{}'; end if;
    end if;

  else
    raise exception 'unsupported object_type: %', p_object_type
      using errcode = 'check_violation';
  end if;

  /*
   * Nothing was cleared, so nothing is recorded. The row was already
   * empty, did not exist, or was not eligible. Raising rolls the whole
   * thing back, which for a repeated request means the second call
   * writes no second audit row - an erasure that did not happen is not
   * evidence of anything.
   *
   * A distinct SQLSTATE so the route can turn this into a sentence
   * rather than a 500.
   */
  if array_length(v_fields, 1) is null then
    raise exception 'nothing to erase'
      using errcode = 'P0002';
  end if;

  /* Same transaction. If this fails, the clear above is rolled back. */
  insert into public.data_erasures (
    object_type, object_id, fields_cleared, row_deleted,
    classification, request_reference, performed_by
  ) values (
    p_object_type, p_object_id, v_fields, false,
    p_classification, p_request_reference, p_performed_by
  );

  return query select v_fields;
end;
$$;

comment on function public.erase_personal_fields is
  'Clears the personal fields of one record and records the erasure, in '
  'one transaction. Either both happen or neither does, so an audit row '
  'always describes an erasure that actually completed. Never deletes a '
  'row. SECURITY INVOKER on purpose.';

-- ============================================================
-- Execution rights
--
-- Admin routes only, through service_role. anon and authenticated are
-- revoked explicitly rather than assumed: on 2026-08-28 a "revoke from
-- public" was assumed to cover anon and did not, and on 2026-08-31 a
-- GRANT naming two verbs was assumed to withhold the others and did not.
-- Privileges have to be stated to be present and revoked to be absent.
--
-- PUBLIC is revoked first because functions are granted to PUBLIC by
-- default, which is the opposite default from tables.
-- ============================================================
revoke all on function public.erase_personal_fields(text, uuid, text, text, text) from public;
revoke all on function public.erase_personal_fields(text, uuid, text, text, text) from anon;
revoke all on function public.erase_personal_fields(text, uuid, text, text, text) from authenticated;

grant execute on function public.erase_personal_fields(text, uuid, text, text, text) to service_role;
