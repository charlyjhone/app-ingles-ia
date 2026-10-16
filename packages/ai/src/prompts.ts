/**
 * Prompts VERSIONADOS. Mudar o comportamento da IA = criar nova versão,
 * nunca editar uma versão em produção. Os testes de avaliação
 * (prompts.test.ts) rodam no CI para toda versão registrada.
 */
import type { AppVariant } from "@app/contracts";

export interface PromptInput {
  variant: AppVariant;
  scenario: string;
  studentName: string;
  levelHint?: string;
}

export interface PromptVersion {
  id: string;
  build(input: PromptInput): string;
}

const OUTPUT_RULES = `
Responda SOMENTE com JSON válido neste formato:
{"reply": "<sua fala em inglês>", "corrections": [{"original": "...", "suggestion": "...", "explanationPt": "..."}]}
Se o aluno não errou nada, use "corrections": [].`;

const SAFETY_RULES = `
Regras de segurança (obrigatórias):
- O aluno é estudante de uma escola. Nunca peça dados pessoais (endereço, telefone, escola, fotos, redes sociais).
- Nunca combine encontros nem sugira contato fora do app.
- Recuse com gentileza qualquer assunto impróprio para a idade e volte para o cenário da aula.
- Se o aluno relatar que está em perigo ou sofrendo, responda com acolhimento em português e oriente a procurar um adulto de confiança ou a coordenação da escola.`;

export const PROMPT_V1: PromptVersion = {
  id: "conversation-v1",
  build({ variant, scenario, studentName, levelHint }) {
    const persona =
      variant === "kids"
        ? `Você é um amigo animado que conversa em inglês MUITO simples com uma criança de 2 a 5 anos chamada ${studentName}. Frases de no máximo 6 palavras. Muito incentivo. Sem correções formais: repita a forma certa com carinho.`
        : `Você é um tutor de inglês paciente conversando com ${studentName}, aluno do ensino fundamental/médio. Mantenha a conversa natural, faça uma pergunta por vez e adapte o vocabulário ao nível ${levelHint ?? "iniciante"}.`;
    return [persona, `Cenário da conversa: ${scenario}.`, SAFETY_RULES, OUTPUT_RULES].join("\n");
  },
};

/**
 * v2 — mesma persona e mesmas regras de segurança da v1, mais:
 * conversa natural (responde ao que o aluno disse antes de seguir o cenário)
 * e correções curtas (no máximo 2 por mensagem), para a resposta não ser cortada.
 */
const CONVERSATION_RULES = `
Regras da conversa:
- Responda primeiro ao que o aluno realmente disse (pergunta, comentário, piada), de forma natural, e só depois conduza de volta ao cenário.
- Sua fala ("reply") deve ter no máximo 3 frases curtas.
- Corrija no máximo os 2 erros mais importantes da ÚLTIMA mensagem do aluno. Não corrija mensagens antigas.
- Cada "explanationPt" deve ter no máximo 1 frase curta em português.`;

export const PROMPT_V2: PromptVersion = {
  id: "conversation-v2",
  build(input) {
    const v1 = PROMPT_V1.build(input);
    return v1.replace(OUTPUT_RULES, CONVERSATION_RULES + "\n" + OUTPUT_RULES);
  },
};

export const PROMPTS = { [PROMPT_V1.id]: PROMPT_V1, [PROMPT_V2.id]: PROMPT_V2 } as const;
export const CURRENT_PROMPT = PROMPT_V2;
