create extension if not exists pgcrypto;

create table if not exists public.accounting_entries (
  id uuid primary key default gen_random_uuid(),
  codigo_conta_financeira text not null,
  nome_conta text not null,
  valor numeric(18,2) not null,
  grupo_conta text not null,
  competencia text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_accounting_entries_competencia on public.accounting_entries (competencia);
create index if not exists idx_accounting_entries_codigo on public.accounting_entries (codigo_conta_financeira);

alter table public.accounting_entries enable row level security;

drop policy if exists "allow_insert_accounting_entries" on public.accounting_entries;
create policy "allow_insert_accounting_entries"
on public.accounting_entries
for insert
to anon, authenticated
with check (true);

drop policy if exists "allow_select_accounting_entries" on public.accounting_entries;
create policy "allow_select_accounting_entries"
on public.accounting_entries
for select
to anon, authenticated
using (true);
