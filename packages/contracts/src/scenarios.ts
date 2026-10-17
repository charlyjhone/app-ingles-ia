/**
 * Catálogo de cenários de conversa.
 * Fica nos contratos porque é usado pelo app (para mostrar as opções) e pelo
 * servidor (para montar as instruções do tutor). O servidor SÓ aceita cenários
 * deste catálogo: o texto que vai para a IA nunca vem do aparelho do aluno.
 *
 * Para criar um cenário novo: adicione aqui (ids nunca mudam depois de publicados).
 */
import { z } from "zod";

export const Level = z.enum(["beginner", "intermediate", "advanced"]);
export type Level = z.infer<typeof Level>;

export const LEVEL_LABEL_PT: Record<Level, string> = {
  beginner: "Iniciante",
  intermediate: "Intermediário",
  advanced: "Avançado",
};

export interface Scenario {
  id: string;
  audience: "student" | "kids";
  emoji: string;
  titlePt: string;
  /** Papel que o tutor interpreta e o lugar onde a conversa acontece (vai para a IA). */
  roleEn: string;
  /** Primeira fala do tutor, mostrada e falada ao abrir a conversa. */
  openerEn: string;
  /** Missão: o que o aluno precisa fazer. null = conversa livre, sem missão. */
  mission: { pt: string; en: string } | null;
}

export const MISSION_XP = 20;

export const SCENARIOS: readonly Scenario[] = [
  {
    id: "restaurant",
    audience: "student",
    emoji: "🍕",
    titlePt: "No restaurante",
    roleEn: "a friendly waiter at Bella Pizza, a pizza restaurant in New York",
    openerEn: "Hi, welcome to Bella Pizza! Here is the menu. What would you like to drink?",
    mission: {
      pt: "Peça uma bebida e um prato e pergunte quanto custa.",
      en: "order a drink and a dish, and ask how much it costs",
    },
  },
  {
    id: "airport",
    audience: "student",
    emoji: "✈️",
    titlePt: "No aeroporto",
    roleEn: "a check-in agent at an airline counter at Orlando airport",
    openerEn: "Good morning! Where are you flying to today?",
    mission: {
      pt: "Faça o check-in: diga para onde vai, mostre o passaporte e peça um assento na janela.",
      en: "say where they are flying to, mention they have their passport, and ask for a window seat",
    },
  },
  {
    id: "school",
    audience: "student",
    emoji: "🏫",
    titlePt: "Primeiro dia na escola",
    roleEn: "a friendly new classmate from Canada on the first day of school",
    openerEn: "Hi! I'm Emma, I'm new here. What's your name?",
    mission: {
      pt: "Apresente-se (nome e matéria favorita) e faça uma pergunta para a colega.",
      en: "introduce themselves with their first name and favorite school subject, and ask the classmate a question",
    },
  },
  {
    id: "directions",
    audience: "student",
    emoji: "🗺️",
    titlePt: "Pedindo informações",
    roleEn: "a helpful local person on a street in London",
    openerEn: "Hello! You look a little lost. Can I help you?",
    mission: {
      pt: "Pergunte como chegar a um museu e confirme o caminho.",
      en: "ask how to get to a museum and repeat the directions back to confirm",
    },
  },
  {
    id: "job-interview",
    audience: "student",
    emoji: "💼",
    titlePt: "Entrevista de emprego",
    roleEn: "a manager interviewing a teenager for a summer job at a bookstore",
    openerEn: "Hello, thanks for coming! Please, tell me a little about yourself.",
    mission: {
      pt: "Fale de uma qualidade sua e explique por que quer a vaga.",
      en: "describe one personal strength and explain why they want the job",
    },
  },
  {
    id: "friends",
    audience: "student",
    emoji: "🎮",
    titlePt: "Fazendo amigos",
    roleEn: "a friendly teenager who loves games and sports, chatting at a youth event",
    openerEn: "Hey! Cool shirt. Do you like games?",
    mission: {
      pt: "Descubra dois hobbies do novo amigo e conte um seu.",
      en: "find out two of the friend's hobbies and share one of their own",
    },
  },
  {
    id: "free",
    audience: "student",
    emoji: "💬",
    titlePt: "Conversa livre",
    roleEn: "a friendly English tutor having a casual conversation about any topic the student likes",
    openerEn: "Hi! What would you like to talk about today?",
    mission: null,
  },
  {
    id: "colors-animals",
    audience: "kids",
    emoji: "🐶",
    titlePt: "Cores e animais",
    roleEn: "a playful friend playing a guessing game about animals and colors",
    openerEn: "Hello, friend! Let's play! What animal do you like?",
    mission: {
      pt: "Diga o nome de 3 animais ou cores em inglês.",
      en: "say the names of three animals or colors in English",
    },
  },
  {
    id: "fruits",
    audience: "kids",
    emoji: "🍎",
    titlePt: "Frutas",
    roleEn: "a playful friend having a pretend picnic with fruits",
    openerEn: "Yummy! Let's have a picnic! Do you like apples?",
    mission: {
      pt: "Diga o nome de 3 frutas em inglês.",
      en: "say the names of three fruits in English",
    },
  },
] as const;

export const DEFAULT_SCENARIO_ID = { student: "free", kids: "colors-animals" } as const;

/** Busca no catálogo; ids desconhecidos voltam null (o servidor então usa o padrão). */
export function getScenario(id: string | undefined | null): Scenario | null {
  return SCENARIOS.find((s) => s.id === id) ?? null;
}

/** Ids antigos aceitos pelo primeiro app publicado (compatibilidade). */
export const LEGACY_SCENARIO_ALIASES: Record<string, string> = {
  "colors and animals": "colors-animals",
};
