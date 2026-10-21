import type { FastifyPluginAsync } from "fastify";
import { ImportStudentsRequest, type ImportStudentsResponse } from "@app/contracts";
import type { Deps } from "../app";
import { makeLogin, makeTemporaryPassword } from "../lib/accounts";
import { HttpError } from "../lib/errors";

const MANAGERS = new Set(["coordinator", "admin"]);

/**
 * Coordenação importa alunos colando uma planilha: cria turmas que faltam, logins e senhas
 * provisórias. A senha aparece só nesta resposta (o banco guarda apenas a versão protegida).
 * Um aluno com problema não impede os outros: cada linha é independente.
 */
export const importRoutes =
  (deps: Deps): FastifyPluginAsync =>
  async (app) => {
    app.post("/import/students", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req): Promise<ImportStudentsResponse> => {
      if (!MANAGERS.has(req.me.role)) throw new HttpError("forbidden", "Somente a coordenação importa alunos");
      const { rows } = ImportStudentsRequest.parse(req.body);
      const schoolId = req.me.schoolId;
      const domain = deps.config.importLoginDomain ?? "aluno.appingles.com";

      const classIds = new Map<string, string>();
      const classesCreated: string[] = [];
      const created: ImportStudentsResponse["created"] = [];
      const failed: ImportStudentsResponse["failed"] = [];

      for (const row of rows) {
        try {
          const key = row.className.toLowerCase();
          let classId = classIds.get(key);
          if (!classId) {
            const c = await deps.repo.findOrCreateClass({ schoolId, name: row.className, grade: row.grade });
            classId = c.id;
            classIds.set(key, classId);
            if (c.created) classesCreated.push(row.className);
          }
          // tenta alguns logins caso o sorteado já exista
          let id: string | null = null;
          let login = "";
          const password = makeTemporaryPassword();
          for (let attempt = 0; attempt < 3 && !id; attempt++) {
            login = makeLogin(row.fullName, domain);
            try {
              id = await deps.repo.createStudentAccount({ schoolId, fullName: row.fullName, kidsMode: row.kidsMode, login, password });
            } catch (e) {
              if (attempt === 2) throw e;
            }
          }
          await deps.repo.addClassMember({ classId, profileId: id!, role: "student" });
          created.push({ fullName: row.fullName, className: row.className, login, temporaryPassword: password });
        } catch (e) {
          req.log.warn({ detail: e instanceof Error ? e.message : String(e) }, "falha ao importar aluno");
          failed.push({ fullName: row.fullName, reason: "Não foi possível criar este aluno. Tente de novo." });
        }
      }

      // Auditoria SEM senhas: só quantidades e turmas.
      await deps.repo.audit({
        actorId: req.me.id,
        schoolId,
        action: "students.imported",
        details: { created: created.length, failed: failed.length, classesCreated },
      });
      return { created, failed, classesCreated };
    });
  };
