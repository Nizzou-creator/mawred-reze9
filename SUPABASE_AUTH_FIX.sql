-- إصلاح إنشاء الحسابات في مورد رزق: حفظ نوع الحساب والهاتف والولاية من بيانات التسجيل.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, account_type, phone, governorate)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    case when new.raw_user_meta_data->>'account_type' in ('customer','provider','seller')
      then new.raw_user_meta_data->>'account_type' else 'customer' end,
    nullif(new.raw_user_meta_data->>'phone',''),
    nullif(new.raw_user_meta_data->>'governorate','')
  )
  on conflict (id) do update set
    full_name=excluded.full_name,
    account_type=excluded.account_type,
    phone=excluded.phone,
    governorate=excluded.governorate;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to postgres;
