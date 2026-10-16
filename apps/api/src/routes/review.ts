import type { FastifyPluginAsync } from "fastify";
import { ReviewAnswerRequest, type ReviewAnswerResponse, type ReviewNextResponse } from "@app/contracts";
import { applyAnswer, pickDue, recallProbability } from "@app/srs";
import type { Deps } from "../app";
import { HttpError } from "../lib/errors";

export const reviewRoutes =
  (deps: Deps): FastifyPluginAsync =>
  async (app) => {
    app.get("/review/next", async (req): Promise<ReviewNextResponse> => {
      const now = deps.now?.() ?? new Date();
      const all = await deps.repo.listReviewItems(req.me.id);
      return {
        items: pickDue(all, now).map((i) => ({
          id: i.id,
          term: i.term,
          translationPt: i.translationPt,
          halfLifeHours: i.halfLifeHours,
          lastSeenAt: i.lastSeenAt.toISOString(),
          recallProbability: recallProbability(i, now),
        })),
      };
    });

    app.post("/review/answer", async (req): Promise<ReviewAnswerResponse> => {
      const body = ReviewAnswerRequest.parse(req.body);
      const now = deps.now?.() ?? new Date();
      // Busca já filtrada pelo aluno: ninguém responde item de outra pessoa.
      const item = await deps.repo.getReviewItem(req.me.id, body.itemId);
      if (!item) throw new HttpError("not_found", "Item não encontrado");

      const next = applyAnswer(item, body.correct, now);
      await deps.repo.updateReviewItem({ ...item, ...next });
      if (body.correct) {
        await deps.repo.addXp({ studentId: req.me.id, schoolId: req.me.schoolId, amount: 2, reason: "review_correct" });
      }
      return { halfLifeHours: next.halfLifeHours };
    });
  };
