create table if not exists public.upload_logs (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  total_rows integer not null default 0,
  total_accounts integer not null default 0,
  total_competencias integer not null default 0,
  total_groups integer not null default 0,
  total_value numeric(18,2) not null default 0,
  status text not null check (status in ('success', 'error')),
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.upload_logs enable row level security;

create policy "allow_insert_upload_logs"
on public.upload_logs
for insert
to anon, authenticated
with check (true);

create policy "allow_select_upload_logs"
on public.upload_logs
for select
to authenticated
using (true);
