/**
 * Feature flags: liga uma função nova primeiro para 1 turma, depois para a
 * escola, depois para todos — e desliga em segundos se der problema,
 * sem novo deploy.
 *
 * Precedência (o mais específico vence): turma > escola > global > padrão do código.
 */

export const FLAG_DEFAULTS = {
  "conversation.voice": true,
  "conversation.pronunciation_feedback": false,
  "gamification.class_leagues": false,
  "kids.songs": true,
  "guardian.weekly_report": false,
} as const;

export type FlagKey = keyof typeof FLAG_DEFAULTS;

export interface FlagRule {
  key: string;
  enabled: boolean;
  schoolId?: string | null;
  classId?: string | null;
}

export interface FlagContext {
  schoolId: string;
  classIds: string[];
}

export function isEnabled(key: FlagKey, rules: FlagRule[], ctx: FlagContext): boolean {
  const forKey = rules.filter((r) => r.key === key);

  const classRule = forKey.find((r) => r.classId && ctx.classIds.includes(r.classId));
  if (classRule) return classRule.enabled;

  const schoolRule = forKey.find((r) => !r.classId && r.schoolId === ctx.schoolId);
  if (schoolRule) return schoolRule.enabled;

  const globalRule = forKey.find((r) => !r.classId && !r.schoolId);
  if (globalRule) return globalRule.enabled;

  return FLAG_DEFAULTS[key];
}
