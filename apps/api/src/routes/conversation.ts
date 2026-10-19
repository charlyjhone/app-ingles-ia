import type { FastifyPluginAsync } from "fastify";
import {
  ConversationTurnRequest,
  DEFAULT_SCENARIO_ID,
  LEGACY_SCENARIO_ALIASES,
  MISSION_XP,
  getScenario,
  type ConversationTurnResponse,
} from "@app/contracts";
import { CURRENT_PROMPT, tutorTurn } from "@app/ai";
import { isEnabled } from "@app/flags";
import type { Deps } from "../app";
import { HttpError } from "../lib/errors";
import { localDayKey } from "../lib/time";

export const conversationRoutes =
  (deps: Deps): FastifyPluginAsync =>
  async (app) => {
    app.post("/conversation/turn", async (req): Promise<ConversationTurnResponse> => {
      const me = req.me;
      if (me.role !== "student") throw new HttpError("forbidden", "Somente alunos conversam com o tutor");

      const body = ConversationTurnRequest.parse(req.body);
      const now = deps.now?.() ?? new Date();
      const dayKey = localDayKey(now, deps.config.timeZone);
      const variant = me.kidsMode ? "kids" : "student";

      if (body.spokenSeconds > 0) {
        const rules = await deps.repo.getFlagRules(me.schoolId);
        const classIds = await deps.repo.getClassIds(me.id);
        if (!isEnabled("conversation.voice", rules, { schoolId: me.schoolId, classIds })) {
          throw new HttpError("feature_disabled", "Conversa por voz desativada para sua turma");
        }
      }

      // Controle de custo: limite diário de minutos por aluno.
      const limitMin = me.kidsMode ? deps.config.minutesKids : deps.config.minutesStudent;
      const usedSec = await deps.repo.getConversationSecondsOnDay(me.id, dayKey);
      if (usedSec >= limitMin * 60) {
        throw new HttpError("quota_exceeded", "Você já praticou bastante hoje! Volte amanhã.");
      }

      // Só cenários do catálogo do servidor: o texto que vai para a IA nunca vem do aparelho.
      const requested = LEGACY_SCENARIO_ALIASES[body.scenario] ?? body.scenario;
      const scenario = getScenario(requested) ?? getScenario(DEFAULT_SCENARIO_ID[variant])!;

      const result = await tutorTurn(
        deps.provider,
        {
          variant,
          scenario: scenario.titlePt,
          studentName: me.fullName.split(" ")[0] ?? "",
          history: body.history,
          userText: body.userText,
          level: body.level,
          roleEn: scenario.roleEn,
          missionEn: scenario.mission?.en ?? null,
          openerEn: scenario.openerEn,
        },
        CURRENT_PROMPT,
        (stage, detail) => req.log.warn({ stage, detail, provider: deps.provider.name }, "falha na IA do tutor"),
      );

      await deps.repo.addConversationUsage({
        studentId: me.id,
        schoolId: me.schoolId,
        sessionId: body.sessionId,
        dayKey,
        seconds: body.spokenSeconds,
      });
      let xpAwarded = 0;
      if (result.blocked) {
        await deps.repo.audit({ actorId: me.id, schoolId: me.schoolId, action: "conversation.blocked" });
      } else {
        await deps.repo.addXp({ studentId: me.id, schoolId: me.schoolId, amount: 5, reason: "conversation_turn" });
        xpAwarded += 5;
        // Missão: paga uma única vez por conversa (sessionId), mesmo que a IA repita "cumprida".
        const missionReason = `mission:${scenario.id}:${body.sessionId}`;
        if (result.missionCompleted && !(await deps.repo.hasXpEvent(me.id, missionReason))) {
          await deps.repo.addXp({ studentId: me.id, schoolId: me.schoolId, amount: MISSION_XP, reason: missionReason });
          xpAwarded += MISSION_XP;
        }
      }

      // Voz natural: se falhar, a conversa segue normalmente (o app usa a voz do aparelho).
      let replyAudio: ConversationTurnResponse["replyAudio"];
      if (body.wantAudio && deps.speech) {
        try {
          replyAudio = await deps.speech.synthesize(result.replyText, { kids: variant === "kids", level: body.level });
        } catch (e) {
          req.log.warn({ detail: e instanceof Error ? e.message : String(e), provider: deps.speech.name }, "falha na voz do tutor");
        }
      }

      // Resposta rápida: o texto vai já; a voz é buscada em seguida com este vale.
      const speechToken =
        body.wantSpeechToken && !body.wantAudio && deps.speech
          ? deps.speechTokens!.issue({ text: result.replyText, studentId: me.id, kids: variant === "kids", level: body.level }, now.getTime())
          : undefined;

      return {
        replyText: result.replyText,
        corrections: result.corrections,
        minutesUsedToday: (usedSec + body.spokenSeconds) / 60,
        minutesLimitToday: limitMin,
        promptVersion: result.promptVersion,
        missionCompleted: result.missionCompleted,
        xpAwarded,
        ...(replyAudio ? { replyAudio } : {}),
        ...(speechToken ? { speechToken } : {}),
      };
    });
  };
