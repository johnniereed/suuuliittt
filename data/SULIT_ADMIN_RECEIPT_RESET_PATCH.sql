-- Sulit Admin: safely reset receipt-generated data only.
-- Keeps products, prices, stores, product aliases, profiles and auth users.
create or replace function public.admin_reset_all_receipt_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_reports integer := 0;
  deleted_items integer := 0;
  deleted_receipts integer := 0;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;

  delete from public.crowd_price_reports;
  get diagnostics deleted_reports = row_count;

  delete from public.receipt_items;
  get diagnostics deleted_items = row_count;

  delete from public.receipts;
  get diagnostics deleted_receipts = row_count;

  return jsonb_build_object(
    'receipts', deleted_receipts,
    'receipt_items', deleted_items,
    'crowd_price_reports', deleted_reports
  );
end;
$$;

revoke all on function public.admin_reset_all_receipt_data() from public;
grant execute on function public.admin_reset_all_receipt_data() to authenticated;
notify pgrst, 'reload schema';
