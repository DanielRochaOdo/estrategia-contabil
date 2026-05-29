alter table public.accounting_entries
  add column if not exists conta text,
  add column if not exists descricao text,
  add column if not exists forma text,
  add column if not exists grupo text,
  add column if not exists mes text;

update public.accounting_entries
set conta = coalesce(conta, codigo_conta_financeira),
    descricao = coalesce(descricao, nome_conta, 'Sem descrição'),
    grupo = coalesce(grupo, grupo_conta, 'Não informado'),
    mes = coalesce(mes, competencia),
    forma = coalesce(forma, 'Não informado')
where conta is null or descricao is null or grupo is null or mes is null or forma is null;

alter table public.accounting_entries alter column conta set not null;
alter table public.accounting_entries alter column descricao set not null;
alter table public.accounting_entries alter column mes set not null;
