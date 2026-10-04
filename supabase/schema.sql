-- مورد رزق V1 database
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  account_type text not null default 'customer'
    check (account_type in ('customer','provider','seller')),
  governorate text,
  delegation text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  listing_type text not null check (listing_type in ('service','product')),
  title text not null,
  description text not null default '',
  price numeric,
  price_label text,
  governorate text,
  delegation text,
  image_url text,
  is_featured boolean not null default false,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists listings_status_idx on public.listings(status);
create index if not exists listings_owner_idx on public.listings(owner_id);
create index if not exists listings_location_idx on public.listings(governorate, delegation);

alter table public.profiles enable row level security;
alter table public.listings enable row level security;

create policy "profiles are readable"
on public.profiles for select
to authenticated
using (true);

create policy "users create own profile"
on public.profiles for insert
to authenticated
with check (auth.uid() = id);

create policy "users update own profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "approved listings are public"
on public.listings for select
to anon, authenticated
using (status = 'approved' or owner_id = auth.uid());

create policy "users create own listings"
on public.listings for insert
to authenticated
with check (owner_id = auth.uid());

create policy "users update own listings"
on public.listings for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "users delete own listings"
on public.listings for delete
to authenticated
using (owner_id = auth.uid());

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
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
