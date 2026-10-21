-- Called only by the Stripe webhook (service role). Idempotent: a replayed event inserts nothing
-- and changes nothing, because stripe_session_id is unique.
create function public.record_payment(
  p_fee_record_id uuid, p_amount numeric, p_currency text, p_session_id text, p_receipt_url text
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  fee public.fee_records;
begin
  select * into fee from public.fee_records where id = p_fee_record_id for update;
  if not found then return false; end if;

  insert into public.payments (institution_id, fee_record_id, student_id, amount, currency, stripe_session_id, receipt_url)
  values (fee.institution_id, fee.id, fee.student_id, p_amount, p_currency, p_session_id, p_receipt_url)
  on conflict (stripe_session_id) do nothing;
  if not found then return false; end if; -- duplicate event

  update public.fee_records set amount_paid = least(amount_due, amount_paid + p_amount) where id = fee.id;
  insert into public.notifications (institution_id, user_id, kind, title, link)
  values (fee.institution_id, fee.student_id, 'payment', 'Payment received: ' || fee.description, '/fees');
  return true;
end $$;

revoke execute on function public.record_payment from public, anon, authenticated;
