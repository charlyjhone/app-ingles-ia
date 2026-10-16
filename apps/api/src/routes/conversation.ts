import type { FastifyPluginAsync } from "fastify";
import { ConversationTurnRequest, type ConversationTurnResponse } from "@app/contracts";
import { tutorTurn } from "@app/ai";
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

      const result = await tutorTurn(deps.provider, {
        variant,
        scenario: body.scenario,
        studentName: me.fullName.split(" ")[0] ?? "",
        history: body.history,
        userText: body.userText,
      });

      await deps.repo.addConversationUsage({
        studentId: me.id,
        schoolId: me.schoolId,
        sessionId: body.sessionId,
        dayKey,
        seconds: body.spokenSeconds,
      });
      if (result.blocked) {
        await deps.repo.audit({ actorId: me.id, schoolId: me.schoolId, action: "conversation.blocked" });
      } else {
        await deps.repo.addXp({ studentId: me.id, schoolId: me.schoolId, amount: 5, reason: "conversation_turn" });
      }

      return {
        replyText: result.replyText,
        corrections: result.corrections,
        minutesUsedToday: (usedSec + body.spokenSeconds) / 60,
        minutesLimitToday: limitMin,
        promptVersion: result.promptVersion,
      };
    });
  };
