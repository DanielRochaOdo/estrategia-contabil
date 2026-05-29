-- Remove existing duplicates globally (semantic duplicates)
with d as (
  select id,
         row_number() over (
           partition by user_id, setor, conta, descricao, valor, coalesce(forma,''), mes
           order by created_at asc, id asc
         ) as rn
  from public.accounting_analytic_records
)
delete from public.accounting_analytic_records t
using d
where t.id = d.id and d.rn > 1;

with d as (
  select id,
         row_number() over (
           partition by user_id, setor, conta, descricao, total, coalesce(grupo,''), mes
           order by created_at asc, id asc
         ) as rn
  from public.accounting_synthetic_records
)
delete from public.accounting_synthetic_records t
using d
where t.id = d.id and d.rn > 1;

-- Add hard DB guards to prevent new duplicates.
create unique index if not exists uq_analytic_semantic
  on public.accounting_analytic_records (user_id, setor, conta, descricao, valor, forma, mes);

create unique index if not exists uq_synthetic_semantic
  on public.accounting_synthetic_records (user_id, setor, conta, descricao, total, grupo, mes);
