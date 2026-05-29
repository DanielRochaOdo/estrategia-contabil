create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  setor text not null,
  role text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check check (role in ('user', 'admin'));

alter table public.profiles
  drop constraint if exists profiles_setor_check;

alter table public.profiles
  add constraint profiles_setor_check check (setor in (
    'ASSESSORIA ESTRATÉGICA',
    'TI',
    'ADMINISTRATIVO',
    'DIRETORIA',
    'DEPARTAMENTO PESSOAL',
    'RH',
    'MARKETING'
  ));

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, setor, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Usuário'),
    new.email,
    coalesce(new.raw_user_meta_data->>'setor', 'ADMINISTRATIVO'),
    'user'
  )
  on conflict (id) do update
  set full_name = excluded.full_name,
      email = excluded.email,
      setor = excluded.setor,
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles
for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_update_own_or_admin" on public.profiles;
create policy "profiles_update_own_or_admin"
on public.profiles
for update
to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

alter table public.accounting_entries
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists profile_id uuid references public.profiles(id) on delete cascade,
  add column if not exists setor text,
  add column if not exists uploaded_file_name text;

update public.accounting_entries ae
set user_id = coalesce(ae.user_id, ae.profile_id),
    profile_id = coalesce(ae.profile_id, ae.user_id)
where ae.user_id is null or ae.profile_id is null;

update public.accounting_entries
set setor = 'ADMINISTRATIVO'
where setor is null;

alter table public.accounting_entries alter column setor set not null;

alter table public.accounting_entries
  drop constraint if exists accounting_entries_setor_check;

alter table public.accounting_entries
  add constraint accounting_entries_setor_check check (setor in (
    'ASSESSORIA ESTRATÉGICA',
    'TI',
    'ADMINISTRATIVO',
    'DIRETORIA',
    'DEPARTAMENTO PESSOAL',
    'RH',
    'MARKETING'
  ));

alter table public.accounting_entries enable row level security;

drop policy if exists "entries_insert_own_or_admin" on public.accounting_entries;
create policy "entries_insert_own_or_admin"
on public.accounting_entries
for insert
to authenticated
with check (
  (user_id = auth.uid() and profile_id = auth.uid())
  or public.is_admin()
);

drop policy if exists "entries_select_own_or_admin" on public.accounting_entries;
create policy "entries_select_own_or_admin"
on public.accounting_entries
for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "entries_update_own_or_admin" on public.accounting_entries;
create policy "entries_update_own_or_admin"
on public.accounting_entries
for update
to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "entries_delete_own_or_admin" on public.accounting_entries;
create policy "entries_delete_own_or_admin"
on public.accounting_entries
for delete
to authenticated
using (user_id = auth.uid() or public.is_admin());
