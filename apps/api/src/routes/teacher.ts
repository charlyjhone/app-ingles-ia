import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { GuardianConsentRequest, type ClassList, type ClassSummary, type GuardianConsentResponse } from "@app/contracts";
import type { Deps } from "../app";
import { HttpError } from "../lib/errors";

const Params = z.object({ classId: z.string().uuid() });
const STAFF = new Set(["teacher", "coordinator", "admin"]);
const MANAGERS = new Set(["coordinator", "admin"]);
const StudentParams = z.object({ studentId: z.string().uuid() });

export const teacherRoutes =
  (deps: Deps): FastifyPluginAsync =>
  async (app) => {
    // LGPD: só a coordenação registra a autorização (termo assinado pelo responsável).
    app.post("/students/:studentId/consent", async (req): Promise<GuardianConsentResponse> => {
      if (!MANAGERS.has(req.me.role)) throw new HttpError("forbidden", "Somente a coordenação registra autorizações");
      const { studentId } = StudentParams.parse(req.params);
      const { given } = GuardianConsentRequest.parse(req.body);
      const at = given ? (deps.now?.() ?? new Date()) : null;
      const ok = await deps.repo.setGuardianConsent({ studentId, schoolId: req.me.schoolId, byId: req.me.id, at });
      if (!ok) throw new HttpError("not_found", "Aluno não encontrado");
      await deps.repo.audit({
        actorId: req.me.id,
        schoolId: req.me.schoolId,
        action: given ? "guardian_consent.recorded" : "guardian_consent.revoked",
        details: { studentId },
      });
      return { guardianConsentAt: at ? at.toISOString() : null };
    });

    app.get("/classes", async (req): Promise<ClassList> => {
      if (!STAFF.has(req.me.role)) throw new HttpError("forbidden", "Acesso restrito a professores e coordenação");
      return { classes: await deps.repo.listClasses(req.me, req.accessToken) };
    });

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
