-- A Thousand Units starter schema. Review and test in a non-production Supabase project first.
create extension if not exists pgcrypto;

create type public.product_status as enum ('draft','published','archived','removed');
create type public.order_status as enum ('pending','paid','payment_initialization_failed','verification_failed','refunded','disputed');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'fan' check (role in ('fan','artist','admin')),
  avatar_url text,
  bio text,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id),
  title text not null,
  description text not null default '',
  product_type text not null check (product_type in ('single','ep','album','live_recording','video','bundle')),
  artwork_path text,
  price_minor integer not null check (price_minor >= 0),
  currency text not null default 'NGN' check (currency = 'NGN'),
  tracklist jsonb not null default '[]'::jsonb,
  benefits jsonb not null default '[]'::jsonb,
  media_path text,
  status public.product_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references public.profiles(id),
  buyer_email text not null,
  product_id uuid not null references public.products(id),
  creator_id uuid not null references public.profiles(id),
  amount_minor integer not null check (amount_minor > 0),
  currency text not null default 'NGN',
  payment_provider text not null default 'paystack',
  payment_reference text not null unique,
  provider_transaction_id text unique,
  status public.order_status not null default 'pending',
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists products_status_published_idx on public.products(status, published_at desc);
create index if not exists products_creator_idx on public.products(creator_id);
create index if not exists orders_buyer_idx on public.orders(buyer_id, created_at desc);
create index if not exists orders_creator_idx on public.orders(creator_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;

create policy "published products are visible" on public.products for select using (status = 'published');
create policy "artists can view own products" on public.products for select to authenticated using (creator_id = auth.uid());
create policy "artists can create own drafts" on public.products for insert to authenticated with check (creator_id = auth.uid());
create policy "artists can update own products" on public.products for update to authenticated using (creator_id = auth.uid()) with check (creator_id = auth.uid());
create policy "users can view own profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "users can create own profile" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "users can update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "buyers can view own orders" on public.orders for select to authenticated using (buyer_id = auth.uid());
create policy "creators can view their orders" on public.orders for select to authenticated using (creator_id = auth.uid());

-- Do not add client INSERT/UPDATE policies for orders. Server-side payment endpoints must create and verify orders.
-- Do not expose the service-role key in the frontend. Configure private Storage buckets and signed URLs for paid media.
