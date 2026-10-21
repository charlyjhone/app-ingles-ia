# App de Inglês com IA

Conversa por voz com IA (estilo BeConfident) + hábito e gamificação (estilo Duolingo) + camada escola
(painel do professor, BNCC, relatório para os pais). Piloto: COC Macapá e Colégio Conceito.

## Documentos

- `docs/01-roteiro-engenharia-reversa-REA.md` — passo a passo do REA
- `docs/02-decisao-comercial-duolingo-vs-beconfident.md` — qual modelo seguir e por quê
- `docs/03-arquitetura.md` — como o sistema é organizado
- `docs/MUDANCAS-SEGURAS.md` — **leia antes de mudar qualquer coisa**
- `docs/04-status-e-proximos-passos.md` — o que já funciona, endereços e pendências

## Estrutura

```
apps/
  api/        backend (Fastify) — rotas /v1, login, limites de custo, auditoria
  mobile/     app Expo — APP_VARIANT=student (aluno) ou kids (infantil);
              o mesmo código gera a versão para computador (navegador)
  web/        painel do professor (Next.js)
packages/
  contracts/  formato de todas as requisições e respostas
  api-client/ cliente único da API (valida tudo que chega)
  srs/        motor de revisão espaçada
  flags/      feature flags (turma > escola > global)
  ai/         adaptador de IA, prompts versionados, filtro de conteúdo
supabase/
  migrations/ esquema do banco + RLS
  tests/      testes de segurança do banco
scripts/      trava de migrações e teste do banco
```

## Rodar no seu Mac

Pré-requisitos: Node.js 22+, pnpm (`corepack enable`), Postgres 16 (só para testar o banco).

```bash
pnpm install
pnpm verify          # trava de migrações + tipos + todos os testes
pnpm db:test         # migrações + testes de RLS (precisa de Postgres local)

# backend sem banco real e sem gastar IA (modo de desenvolvimento)
cp .env.example .env # preencha as chaves do Supabase
pnpm --filter @app/api dev

pnpm --filter @app/mobile start        # app do aluno
pnpm --filter @app/mobile start:kids   # app infantil
pnpm --filter @app/mobile web          # app do aluno no navegador (computador)
pnpm --filter @app/web dev             # painel do professor
```

## Próximos passos para ir ao ar

1. ~~Criar o projeto no Supabase e aplicar as migrações~~ ✓ feito em 16/10/2026 (projeto `app-ingles-ia`, região São Paulo).
2. **Renomear a pasta `_github` para `.github`** (no Terminal: `mv _github .github`). É ela que liga o CI.
   Depois criar o repositório no GitHub, subir este código e ligar a proteção da `main` (ver `MUDANCAS-SEGURAS.md`).
3. Conectar o `render.yaml` no Render (staging + produção) e preencher as variáveis.
4. Criar o projeto no Expo (EAS) e trocar `SEU-PROJECT-ID` em `apps/mobile/app.config.ts`.
5. Definir nome e marca próprios do produto (os atuais são provisórios).
