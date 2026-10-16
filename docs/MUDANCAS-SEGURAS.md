# Como mudar o app sem quebrar nada

Este é o procedimento obrigatório para qualquer alteração — sua, de um programador contratado ou de uma IA.

## O fluxo

1. **Branch:** toda mudança nasce num branch. A `main` é protegida.
2. **Pull request:** preencha o checklist do modelo de PR.
3. **CI automático** (`.github/workflows/ci.yml`) roda:
   - trava de migrações (`pnpm check:migrations`);
   - checagem de tipos de **todos** os apps, painel, backend e pacotes;
   - testes de unidade, API, contratos e segurança da IA;
   - todas as migrações aplicadas do zero + testes de RLS num Postgres real;
   - build do backend e do painel.
   Se qualquer um falhar, o merge fica bloqueado.
4. **Staging:** merge no branch `staging` → deploy automático no ambiente de teste.
5. **Produção:** merge na `main` → deploy no Render. Se `/health` não responder, o Render mantém a versão anterior.
6. **Liberação gradual:** função nova atrás de feature flag → 1 turma → escola → todos.
7. **Desfazer:** desligar a flag (segundos) ou "Rollback" no Render (minutos). App: `eas update` com a versão anterior.

## Regras que não se quebram

### Contratos (`packages/contracts`)
- Pode **adicionar** campos opcionais.
- **Nunca** remover, renomear ou tornar obrigatório um campo da `v1`.
- Mudança que quebra = schema novo + rota `/v2`, mantendo a `/v1` até todos os apps atualizarem.
- O teste `contracts.test.ts` simula um app antigo; se falhar, você quebrou compatibilidade.

### Banco de dados (padrão expandir → migrar → contrair)
Exemplo: trocar `full_name` por `first_name` + `last_name`.
1. **Expandir:** migração nova adiciona as colunas novas (nada é removido).
2. **Migrar:** backend escreve nas duas; script copia os dados antigos.
3. **Contrair:** só depois que nenhum app usa a coluna antiga, uma migração remove `full_name`
   com a linha marcada `-- allow-destructive: <motivo>` e aprovação explícita.

A trava `scripts/check-migrations.mjs` impede:
- editar uma migração já publicada (hash em `supabase/migrations.lock`);
- `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, `RENAME`, mudança de tipo, desligar RLS, sem marcador;
- criar tabela sem ligar RLS.

Ao publicar uma migração nova: `node scripts/check-migrations.mjs --lock` e commit do `migrations.lock`.

### IA
- Prompt em produção não se edita: cria-se `conversation-v2` em `packages/ai/src/prompts.ts`.
- Todo prompt registrado passa pelos testes de avaliação no CI.

## Configuração única no GitHub (fazer uma vez)

Settings → Branches → Add rule para `main`:
- Require a pull request before merging
- Require status checks to pass: **Migrações, tipos e testes** e **Banco de dados e segurança (RLS)**
- Do not allow bypassing the above settings

## Backups

Supabase Pro com PITR (recuperação para qualquer minuto dos últimos dias). Testar uma restauração por trimestre.
