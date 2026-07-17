-- Sulit launch features: product demand queue, notifications and tax classification
alter table public.products add column if not exists tax_rate numeric not null default 0;

create table if not exists public.product_requests (
  id uuid primary key default gen_random_uuid(),
  normalized_query text not null,
  display_query text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','fulfilled','dismissed')),
  fulfilled_product_id bigint references public.products(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(normalized_query,user_id)
);
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  request_query text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
drop policy if exists "Users read own notifications" on public.notifications;
create policy "Users read own notifications" on public.notifications for select to authenticated using (auth.uid()=user_id);
drop policy if exists "Users update own notifications" on public.notifications;
create policy "Users update own notifications" on public.notifications for update to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
drop policy if exists "Admins create notifications" on public.notifications;
create policy "Admins create notifications" on public.notifications for insert to authenticated with check (public.is_admin());

create index if not exists product_requests_status_idx on public.product_requests(status,updated_at desc);
alter table public.product_requests enable row level security;
drop policy if exists "Users create own product requests" on public.product_requests;
create policy "Users create own product requests" on public.product_requests for insert to authenticated with check (auth.uid()=user_id);
drop policy if exists "Users read own product requests" on public.product_requests;
create policy "Users read own product requests" on public.product_requests for select to authenticated using (auth.uid()=user_id or public.is_admin());
drop policy if exists "Admins manage product requests" on public.product_requests;
create policy "Admins manage product requests" on public.product_requests for all to authenticated using (public.is_admin()) with check (public.is_admin());
notify pgrst, 'reload schema';
