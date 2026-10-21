import type { FastifyPluginAsync } from "fastify";
import type { ProgressResponse } from "@app/contracts";
import { pickDue } from "@app/srs";
import type { Deps } from "../app";
import { computeProgress } from "../lib/progress";

/** Progresso do próprio aluno: sequência de dias, meta diária e palavras para revisar. */
export const progressRoutes =
  (deps: Deps): FastifyPluginAsync =>
  async (app) => {
    app.get("/me/progress", async (req): Promise<ProgressResponse> => {
      const now = deps.now?.() ?? new Date();
      const since = new Date(now.getTime() - 120 * 86_400_000);
      const [events, items] = await Promise.all([
        deps.repo.listXpSince(req.me.id, since),
        deps.repo.listReviewItems(req.me.id),
      ]);
      return {
        ...computeProgress(events, now, deps.config.timeZone),
        reviewsDue: pickDue(items, now, 1000).length,
      };
    });
  };
