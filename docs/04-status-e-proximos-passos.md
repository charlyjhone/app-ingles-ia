# Status do projeto e próximos passos

_Atualizado em 21/10/2026._

## Endereços

| O quê | Endereço |
|---|---|
| App do aluno (navegador/celular) | https://ingles-ia-app.onrender.com |
| Painel do professor/coordenação | https://ingles-ia-painel.onrender.com |
| Servidor (API) | https://ingles-ia-api-6i9x.onrender.com (`/health` para verificar) |
| Código | github.com/charlyjhone/app-ingles-ia (CI roda a cada envio) |

Login de teste do app: `aluno.teste@appingles.com` (senha definida no Supabase).

## O que já funciona

**Aluno**
- Login; tela inicial com 🔥 sequência de dias, meta diária (30 pontos) e palavras para revisar.
- 7 situações de conversa (restaurante, aeroporto, escola, informações, entrevista, amigos, livre) e 3 níveis.
- Missões por situação (+20 pontos, uma vez por conversa).
- Voz: o aluno fala pelo microfone; o tutor responde com voz natural (OpenAI), o texto aparece
  primeiro e a voz chega em seguida. Funciona no Chrome, Edge e Safari.
- Correções curtas em português, e até 2 palavras por fala vão automaticamente para a revisão espaçada.
- Revisão espaçada (as palavras voltam no momento certo para não esquecer).

**Professor / coordenação (painel)**
- Login; lista de turmas; por aluno: pontos, missões, minutos falando, palavras para revisar,
  último acesso (⚠️ para quem está 3+ dias sem praticar).
- Coordenação: **importar alunos colando a planilha** (cria turmas, logins e senhas provisórias;
  baixa a lista de acessos — as senhas aparecem uma única vez).
- Coordenação: **registrar a autorização do responsável** (LGPD) e imprimir o **modelo de termo** (`/termo`).

**Segurança e robustez**
- Banco com regras de acesso por escola/turma (RLS) testadas automaticamente no CI.
- Migrações só podem ADICIONAR (trava automática bloqueia apagar/renomear).
- Campos novos sempre opcionais: apps antigos continuam funcionando.
- Dados pessoais (e-mail, telefone, CPF) removidos antes de qualquer texto ir para a IA, inclusive do histórico.
- A voz só é gerada para falas do próprio servidor (vale assinado, 10 min, só do próprio aluno).
- Limite diário de minutos por aluno (controle de custo) e auditoria de ações sensíveis.

## Interruptores (ligar por escola ou turma, sem novo deploy)

| Interruptor | Padrão | Para quê |
|---|---|---|
| `privacy.require_guardian_consent` | desligado | Só conversa quem tem autorização do responsável registrada. **Ligar antes do piloto com alunos reais.** |
| `conversation.voice` | ligado | Microfone na conversa |

Para ligar na escola: tabela `feature_flags` no Supabase (`key`, `enabled = true`, `school_id` da escola).

## Próximos passos técnicos (Claude)

1. Nota de pronúncia (diferencial frente ao Duolingo), com cuidado LGPD para menores.
2. App infantil publicado (mesmo código, `APP_VARIANT=kids`).
3. Relatório semanal para os pais.
4. Publicação nas lojas (App Store / Google Play) depois do piloto.

## Pendências do Charly (deixadas por último)

1. **Criar o seu login de professor/coordenação** no Supabase (Authentication → Users → Add user →
   Create new user, com "Auto Confirm User") e informar o e-mail — Claude vincula como coordenação
   da escola de teste.
2. **Revisar o termo de autorização** (`/termo` no painel) com a assessoria jurídica da escola.
3. **Planos pagos antes do piloto**: Render (servidor sem "dormir", ~US$ 7/mês por serviço) e
   Supabase Pro (US$ 25/mês, backups diários e proteção contra senhas vazadas).
4. **Regra de redirecionamento** no Render (serviço `ingles-ia-app` → Redirects/Rewrites:
   `/*` → `/index.html`, tipo Rewrite) para que links diretos de telas funcionem.
5. **Ligar a conexão GitHub no workspace do Render** para publicar sozinho a cada mudança
   (aí o repositório pode voltar a ser privado).
6. Escolher a **turma piloto** e o professor responsável.
