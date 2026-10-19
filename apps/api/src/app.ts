import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { ZodError } from "zod";
import type { Me } from "@app/contracts";
import type { ConversationProvider, SpeechProvider } from "@app/ai";
import type { AppConfig } from "./config";
import { bearer, type TokenVerifier } from "./lib/auth";
import { SpeechTokens } from "./lib/speech-token";
import { HttpError, errorBody } from "./lib/errors";
import type { Repo } from "./repo/types";
import { conversationRoutes } from "./routes/conversation";
import { reviewRoutes } from "./routes/review";
import { speechRoutes } from "./routes/speech";
import { teacherRoutes } from "./routes/teacher";

export interface Deps {
  repo: Repo;
  provider: ConversationProvider;
  /** voz natural do tutor; null/ausente = app usa a voz do aparelho */
  speech?: SpeechProvider | null;
  verifyToken: TokenVerifier;
  config: AppConfig;
  now?: () => Date;
  /** criado automaticamente a partir da config */
  speechTokens?: SpeechTokens;
}

declare module "fastify" {
  interface FastifyRequest {
    me: Me;
    accessToken: string;
  }
}

export async function buildApp(deps: Deps): Promise<FastifyInstance> {
  deps.speechTokens ??= new SpeechTokens(deps.config.speechSecret);
  const app = Fastify({
    logger: process.env.NODE_ENV === "test" ? false : { redact: ["req.headers.authorization"] },
    bodyLimit: 64 * 1024,
  });

  await app.register(helmet);
  await app.register(cors, { origin: deps.config.allowedOrigins });
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof HttpError) return reply.status(err.status).send(errorBody(err.code, err.message));
    if (err instanceof ZodError) return reply.status(400).send(errorBody("invalid_request", "Dados inválidos"));
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 429) return reply.status(429).send(errorBody("quota_exceeded", "Muitas requisições, aguarde"));
    if (status && status < 500) return reply.status(status).send(errorBody("invalid_request", "Requisição inválida"));
    app.log.error(err);
    // Nunca vaza detalhes internos para o app.
    return reply.status(500).send(errorBody("internal", "Erro interno. Tente novamente."));
  });

  app.get("/", async () => ({
    servico: "API do App de Inglês com IA",
    status: "no ar",
    versao: deps.config.version,
    observacao: "Este endereço é usado pelos apps. Verificação de saúde: /health",
  }));
  app.get("/health", async () => ({ ok: true, version: deps.config.version }));

  // Tudo dentro de /v1 exige login. Uma futura /v2 é registrada AO LADO, sem tocar nesta.
  await app.register(
    async (v1) => {
      v1.decorateRequest("me", null as unknown as Me);
      v1.decorateRequest("accessToken", "");
      v1.addHook("onRequest", async (req: FastifyRequest) => {
        const token = bearer(req.headers.authorization);
        const { userId } = await deps.verifyToken(token);
        const me = await deps.repo.getMe(userId);
        if (!me) throw new HttpError("forbidden", "Usuário sem cadastro na escola");
        req.me = me;
        req.accessToken = token;
      });

      v1.get("/me", async (req) => req.me);
      await v1.register(conversationRoutes(deps));
      await v1.register(reviewRoutes(deps));
      await v1.register(speechRoutes(deps));
      await v1.register(teacherRoutes(deps));
    },
    { prefix: "/v1" },
  );

  return app;
}
