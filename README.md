# Contabilidade Estratégica

Dashboard front-end em React + TypeScript para análise financeira com importação XLSX, DRE horizontal, ranking, gráficos e exportação.

## Rodar local

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Supabase (registro de uploads)

O app registra cada upload na tabela `public.upload_logs`.

1. Configure variáveis em `.env`:

```bash
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SEU_ANON_KEY
```

2. Execute no SQL Editor do Supabase o script:

- `supabase/upload_logs.sql`

### Segurança

- `VITE_*` vai para o navegador. Use somente a chave pública `anon` com `VITE_`.
- A chave `service_role` nunca deve ser usada ou exposta no front-end ou no workflow de keepalive.

### Keepalive no GitHub Actions

O workflow `.github/workflows/supabase-keepalive.yml` executa diariamente às
03:17 UTC (00:17 no horário de Fortaleza) e também pode ser iniciado manualmente.
Ele faz uma leitura mínima da coluna `id` em `public.accounting_entries`, tabela
que possui uma policy RLS de leitura para o papel `anon`.

No GitHub, abra **Settings > Secrets and variables > Actions**, selecione
**New repository secret** e cadastre:

- `SUPABASE_URL`: URL do projeto Supabase, por exemplo `https://SEU-PROJETO.supabase.co`.
- `SUPABASE_ANON_KEY`: chave pública `anon` do projeto Supabase.

Não cadastre nem use a chave `service_role` para esse workflow.

Para testar manualmente depois do push, abra a aba **Actions**, selecione
**Supabase Keepalive**, clique em **Run workflow** e confirme em **Run workflow**.
Abra a execução criada e verifique se o job `keepalive` terminou com o status
verde **Success**.

## Deploy Vercel

- Framework: Vite
- Build: `npm run build`
- Output: `dist`
- Variáveis de ambiente no projeto Vercel:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
