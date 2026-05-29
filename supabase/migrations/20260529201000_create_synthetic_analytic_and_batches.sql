create extension if not exists pgcrypto;

create table if not exists public.accounting_upload_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  setor text not null,
  file_name text not null,
  synthetic_rows_count integer not null default 0,
  analytic_rows_count integer not null default 0,
  inconsistencies_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.accounting_synthetic_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  setor text not null,
  conta text not null,
  descricao text not null,
  total numeric not null,
  grupo text,
  mes text not null,
  uploaded_file_name text,
  upload_batch_id uuid references public.accounting_upload_batches(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.accounting_analytic_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  setor text not null,
  conta text not null,
  descricao text not null,
  valor numeric not null,
  forma text,
  mes text not null,
  uploaded_file_name text,
  upload_batch_id uuid references public.accounting_upload_batches(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.accounting_upload_batches enable row level security;
alter table public.accounting_synthetic_records enable row level security;
alter table public.accounting_analytic_records enable row level security;

drop policy if exists "batches_select_own_or_admin" on public.accounting_upload_batches;
create policy "batches_select_own_or_admin"
on public.accounting_upload_batches
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "batches_insert_own_or_admin" on public.accounting_upload_batches;
create policy "batches_insert_own_or_admin"
on public.accounting_upload_batches
for insert
to authenticated
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "synthetic_select_own_or_admin" on public.accounting_synthetic_records;
create policy "synthetic_select_own_or_admin"
on public.accounting_synthetic_records
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "synthetic_insert_own_or_admin" on public.accounting_synthetic_records;
create policy "synthetic_insert_own_or_admin"
on public.accounting_synthetic_records
for insert
to authenticated
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "analytic_select_own_or_admin" on public.accounting_analytic_records;
create policy "analytic_select_own_or_admin"
on public.accounting_analytic_records
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "analytic_insert_own_or_admin" on public.accounting_analytic_records;
create policy "analytic_insert_own_or_admin"
on public.accounting_analytic_records
for insert
to authenticated
with check (user_id = auth.uid() or public.is_admin());
