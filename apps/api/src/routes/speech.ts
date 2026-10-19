import type { FastifyPluginAsync } from "fastify";
import {
  DEFAULT_SCENARIO_ID,
  LEGACY_SCENARIO_ALIASES,
  SpeechOpenerRequest,
  SpeechReplyRequest,
  getScenario,
  type SpeechAudio,
  type SpeechOpenerResponse,
} from "@app/contracts";
import type { Deps } from "../app";
import { HttpError } from "../lib/errors";

/**
 * Áudio da primeira fala de cada cenário. O texto vem do catálogo (nunca do aparelho),
 * então o mesmo áudio serve para todos os alunos: guardamos em memória e só pagamos
 * a geração uma vez por cenário/nível/variante.
 */
export const speechRoutes =
  (deps: Deps): FastifyPluginAsync =>
  async (app) => {
    const cache = new Map<string, SpeechAudio>();

    app.post("/speech/reply", async (req): Promise<SpeechOpenerResponse> => {
      const { token } = SpeechReplyRequest.parse(req.body);
      const claim = deps.speechTokens!.verify(token, req.me.id, (deps.now?.() ?? new Date()).getTime());
      if (!claim) throw new HttpError("forbidden", "Vale de voz inválido ou expirado");
      if (!deps.speech) return { audio: null };
      try {
        return { audio: await deps.speech.synthesize(claim.text, { kids: claim.kids, level: claim.level }) };
      } catch (e) {
        req.log.warn({ detail: e instanceof Error ? e.message : String(e), provider: deps.speech.name }, "falha na voz do tutor");
        return { audio: null };
      }
    });

    app.post("/speech/opener", async (req): Promise<SpeechOpenerResponse> => {
      const body = SpeechOpenerRequest.parse(req.body);
      if (!deps.speech) return { audio: null };

      const kids = req.me.kidsMode;
      const requested = LEGACY_SCENARIO_ALIASES[body.scenario] ?? body.scenario;
      const scenario = getScenario(requested) ?? getScenario(DEFAULT_SCENARIO_ID[kids ? "kids" : "student"])!;
      const level = kids ? "beginner" : body.level;
      const key = `${scenario.id}:${level}:${kids ? "kids" : "student"}`;

      const hit = cache.get(key);
      if (hit) return { audio: hit };
      try {
        const audio = await deps.speech.synthesize(scenario.openerEn, { kids, level });
        if (cache.size > 200) cache.clear();
        cache.set(key, audio);
        return { audio };
      } catch (e) {
        req.log.warn({ detail: e instanceof Error ? e.message : String(e), provider: deps.speech.name }, "falha na voz do tutor");
        return { audio: null };
      }
    });
  };
