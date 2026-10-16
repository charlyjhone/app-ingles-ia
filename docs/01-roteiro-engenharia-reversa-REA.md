# Roteiro de engenharia reversa com o REA (Duolingo como referência)

Atualizado em 15/10/2026 · Charly Jhone

Objetivo: usar o REA (Reverse Engineer Anything) para **entender o comportamento** do Duolingo
(fluxos, mecânicas, motor de revisão, dados) e construir algo melhor, sem copiar.

## Regra de ouro: comportamento sim, código não

O próprio REA declara que serve para engenharia reversa legal; os termos do Duolingo proíbem descompilar o app.

- **Não**: descompilar APK/iOS, extrair conteúdo, frases, áudios, a coruja, a marca ou o design visual.
- **Sim**: analisar o site com **a sua própria conta**, os estudos publicados pelo Duolingo e avaliações públicas.

## Fase 1 — Instalar o REA

1. Node.js 24 LTS e Claude Code instalados.
2. Pasta de pesquisa, ex.: `pesquisa-duolingo/`.
3. `npx rea-agents setup` e depois `rea doctor --json`.
4. Reiniciar o Claude Code. Fixar a versão do REA (não atualizar automaticamente).

## Fase 2 — Mapear o produto (camada visível)

Prompt:
> "Use o REA no modo website em duolingo.com (minha conta). Mapeie e documente com screenshots: onboarding,
> nivelamento, trilha, tipos de exercício, XP, ofensiva, vidas, ligas, missões, notificações e paywall.
> Para cada mecânica: o que faz, quando aparece e que comportamento tenta provocar.
> Salve em `01-mapa-produto.md`. Não copie textos nem conteúdo das lições."

## Fase 3 — Entender o motor (camada invisível)

1. **Pesquisa pública:** artigo *Half-Life Regression* (Settles & Meeder, ACL 2016) e posts sobre o *Birdbrain*.
2. **HAR da própria sessão:** exportar pelo DevTools e pedir ao REA só o **modelo de dados** (estrutura da lição,
   eventos de progresso, ajuste de dificuldade). Arquivo `02-modelo-motor.md`.
3. **Caixa-preta:** errar de propósito, ficar 2 dias sem estudar, registrar como o app reage.

## Fase 4 — Mapear fraquezas (`03-lacunas.md`)

- Muita tradução, pouca conversa real.
- Fala avaliada de forma superficial.
- Gamificação premia hábito mais que aprendizado.
- Nenhum vínculo com escola, professor ou currículo.
- Paywall e vidas punem quem erra.

## Fase 5 — Produto "melhor que o Duolingo"

| Duolingo | Nosso app |
| --- | --- |
| Exercícios de tradução | Conversa com IA desde a 1ª aula |
| Fala simples | Feedback de pronúncia e diálogo livre por voz |
| Revisão genérica | Revisão espaçada + erros da sala de aula |
| Sem professor | Painel do professor |
| Sem currículo | Alinhado à BNCC e à série |
| Gamificação individual | Ligas entre turmas + relatório para os pais |
| Duolingo ABC (leitura) | Versão infantil 2–5 anos: músicas, vídeos, jogos de voz |
| Vidas punem o erro | Erro vira revisão personalizada |

## Fase 6 — MVP

Supabase + Render + Expo (este repositório). Motor de revisão próprio (half-life regression simplificado).
Usar o REA também no nosso app para comparar fluxos com o mapa da Fase 2.

## Fase 7 — Piloto

1 turma do COC Macapá + 1 do Colégio Conceito, 4 a 6 semanas, pré e pós-teste de inglês,
retenção D1/D7/D30, minutos de fala por aluno, uso pelos professores.
