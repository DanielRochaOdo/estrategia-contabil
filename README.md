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
SUPABASE_SERVICE_ROLE_KEY=SEU_SERVICE_ROLE_KEY
```

2. Execute no SQL Editor do Supabase o script:
- `supabase/upload_logs.sql`

### Segurança
- `VITE_*` vai para o navegador. Use somente `anon key` com `VITE_`.
- `service_role` nunca deve ser exposta no front-end.

## Deploy Vercel
- Framework: Vite
- Build: `npm run build`
- Output: `dist`
- Variáveis de ambiente no projeto Vercel:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
