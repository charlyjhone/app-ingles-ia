import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { ClassSummary } from "@app/contracts";
import type { Deps } from "../app";
import { HttpError } from "../lib/errors";

const Params = z.object({ classId: z.string().uuid() });
const STAFF = new Set(["teacher", "coordinator", "admin"]);

export const teacherRoutes =
  (deps: Deps): FastifyPluginAsync =>
  async (app) => {
    app.get("/classes/:classId/summary", async (req): Promise<ClassSummary> => {
      if (!STAFF.has(req.me.role)) throw new HttpError("forbidden", "Acesso restrito a professores e coordenação");
      const { classId } = Params.parse(req.params);
      const summary = await deps.repo.getClassSummary(classId, req.me, req.accessToken);
      // 404 em vez de 403: não revela se a turma existe em outra escola.
      if (!summary) throw new HttpError("not_found", "Turma não encontrada");
      await deps.repo.audit({ actorId: req.me.id, schoolId: req.me.schoolId, action: "class.summary.view", details: { classId } });
      return summary;
    });
  };
