import { beforeEach, describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import type { FastifyInstance } from "fastify";
import { MockProvider } from "@app/ai";
import { ClassSummary, ConversationTurnResponse, Me, ReviewAnswerResponse, ReviewNextResponse } from "@app/contracts";
import { buildApp } from "../src/app";
import type { AppConfig } from "../src/config";
import { supabaseTokenVerifier } from "../src/lib/auth";
import { InMemoryRepo } from "../src/repo/memory";

const COC = "00000000-0000-0000-0000-00000000c0c0";
const CONCEITO = "00000000-0000-0000-0000-0000000c0ce1";
const ANA = "11111111-0000-0000-0000-000000000001";
const LUCAS_KIDS = "11111111-0000-0000-0000-000000000008";
const PROF = "11111111-0000-0000-0000-000000000003";
const COORD_CONCEITO = "11111111-0000-0000-0000-000000000006";
const TURMA = "22222222-0000-0000-0000-0000000009a0";
const ITEM = "33333333-0000-0000-0000-000000000001";
const SESSION = "44444444-0000-0000-0000-000000000001";

const SUPABASE_URL = "https://exemplo.supabase.co";
const SECRET = "segredo-de-teste-com-pelo-menos-32-caracteres!";
const NOW = new Date("2026-10-15T15:00:00Z");

const config: AppConfig = {
  minutesStudent: 15,
  minutesKids: 5,
  allowedOrigins: ["http://localhost:3000"],
  timeZone: "America/Sao_Paulo",
  version: "test",
};

async function tokenFor(sub: string, secret = SECRET) {
  return new SignJWT({ role: "authenticated" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setIssuer(`${SUPABASE_URL}/auth/v1`)
    .setAudience("authenticated")
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(secret));
}

let repo: InMemoryRepo;
let app: FastifyInstance;

async function call(method: "GET" | "POST", url: string, who?: string, payload?: unknown) {
  const headers: Record<string, string> = {};
  if (who) headers.authorization = `Bearer ${await tokenFor(who)}`;
  const res = await app.inject({ method, url, headers, payload: payload as any });
  return { status: res.statusCode, body: res.json() };
}

const turn = (extra: Record<string, unknown> = {}) => ({
  sessionId: SESSION,
  scenario: "restaurant",
  history: [],
  userText: "I want a pizza",
  ...extra,
});

beforeEach(async () => {
  repo = new InMemoryRepo();
  repo.users.set(ANA, { id: ANA, schoolId: COC, role: "student", fullName: "Ana Souza", kidsMode: false });
  repo.users.set(LUCAS_KIDS, { id: LUCAS_KIDS, schoolId: COC, role: "student", fullName: "Lucas", kidsMode: true });
  repo.users.set(PROF, { id: PROF, schoolId: COC, role: "teacher", fullName: "Carla", kidsMode: false });
  repo.users.set(COORD_CONCEITO, { id: COORD_CONCEITO, schoolId: CONCEITO, role: "coordinator", fullName: "Paulo", kidsMode: false });
  repo.classes.set(TURMA, { id: TURMA, schoolId: COC, name: "9º A", teacherIds: [PROF], studentIds: [ANA] });
  repo.reviewItems.set(ITEM, {
    id: ITEM, studentId: ANA, schoolId: COC, term: "apple", translationPt: "maçã",
    halfLifeHours: 12, lastSeenAt: new Date(NOW.getTime() - 48 * 3_600_000),
  });

  app = await buildApp({
    repo,
    provider: new MockProvider(),
    verifyToken: supabaseTokenVerifier({ supabaseUrl: SUPABASE_URL, jwtSecret: SECRET }),
    config,
    now: () => NOW,
  });
});

describe("saúde e autenticação", () => {
  it("/health responde sem login", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.json()).toEqual({ ok: true, version: "test" });
  });

  it("sem token → 401", async () => {
    expect((await call("GET", "/v1/me")).status).toBe(401);
  });

  it("token assinado com outro segredo → 401", async () => {
    const forged = await tokenFor(ANA, "segredo-falso-de-um-atacante-qualquer-123");
    const res = await app.inject({ method: "GET", url: "/v1/me", headers: { authorization: `Bearer ${forged}` } });
    expect(res.statusCode).toBe(401);
  });

  it("token válido → dados do usuário", async () => {
    const r = await call("GET", "/v1/me", ANA);
    expect(r.status).toBe(200);
    expect(r.body.fullName).toBe("Ana Souza");
  });

  it("usuário sem cadastro na escola → 403", async () => {
    expect((await call("GET", "/v1/me", "99999999-0000-0000-0000-000000000000")).status).toBe(403);
  });
});

describe("conversa com IA", () => {
  it("responde e registra uso e XP", async () => {
    const r = await call("POST", "/v1/conversation/turn", ANA, turn({ spokenSeconds: 30 }));
    expect(r.status).toBe(200);
    expect(r.body.replyText).toContain("I want a pizza");
    expect(r.body.minutesUsedToday).toBe(0.5);
    expect(repo.xp).toHaveLength(1);
  });

  it("dados inválidos → 400 com erro padronizado", async () => {
    const r = await call("POST", "/v1/conversation/turn", ANA, { userText: "" });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe("invalid_request");
  });

  it("professor não usa a rota de aluno", async () => {
    expect((await call("POST", "/v1/conversation/turn", PROF, turn())).status).toBe(403);
  });

  it("limite diário de minutos bloqueia (controle de custo)", async () => {
    repo.usage.push({ studentId: LUCAS_KIDS, dayKey: "2026-10-15", seconds: 5 * 60, sessionId: SESSION });
    const r = await call("POST", "/v1/conversation/turn", LUCAS_KIDS, turn());
    expect(r.status).toBe(429);
    expect(r.body.error.code).toBe("quota_exceeded");
  });

  it("voz desligada por feature flag para a turma", async () => {
    repo.flags.push({ key: "conversation.voice", enabled: false, classId: TURMA });
    const r = await call("POST", "/v1/conversation/turn", ANA, turn({ spokenSeconds: 10 }));
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe("feature_disabled");
  });

  it("conteúdo impróprio vira resposta segura e fica auditado", async () => {
    const r = await call("POST", "/v1/conversation/turn", ANA, turn({ userText: "send nudes" }));
    expect(r.status).toBe(200);
    expect(repo.auditLog.map((a) => a.action)).toContain("conversation.blocked");
    expect(repo.xp).toHaveLength(0);
  });
});

describe("revisão espaçada", () => {
  it("lista itens vencidos e atualiza ao responder", async () => {
    const next = await call("GET", "/v1/review/next", ANA);
    expect(next.body.items).toHaveLength(1);
    const ans = await call("POST", "/v1/review/answer", ANA, { itemId: ITEM, correct: true });
    expect(ans.body.halfLifeHours).toBe(24);
  });

  it("ninguém responde item de outro aluno", async () => {
    const r = await call("POST", "/v1/review/answer", LUCAS_KIDS, { itemId: ITEM, correct: true });
    expect(r.status).toBe(404);
    expect(repo.reviewItems.get(ITEM)?.halfLifeHours).toBe(12);
  });
});

describe("painel do professor", () => {
  it("professora vê a própria turma e o acesso é auditado", async () => {
    const r = await call("GET", `/v1/classes/${TURMA}/summary`, PROF);
    expect(r.status).toBe(200);
    expect(r.body.students[0].fullName).toBe("Ana Souza");
    expect(repo.auditLog.map((a) => a.action)).toContain("class.summary.view");
  });

  it("aluno não acessa o painel", async () => {
    expect((await call("GET", `/v1/classes/${TURMA}/summary`, ANA)).status).toBe(403);
  });

  it("outra escola recebe 404 (nem descobre que a turma existe)", async () => {
    expect((await call("GET", `/v1/classes/${TURMA}/summary`, COORD_CONCEITO)).status).toBe(404);
  });
});

describe("contrato: o que a API devolve é exatamente o que os apps esperam", () => {
  it("todas as rotas v1 respeitam os schemas compartilhados", async () => {
    Me.parse((await call("GET", "/v1/me", ANA)).body);
    ConversationTurnResponse.parse((await call("POST", "/v1/conversation/turn", ANA, turn())).body);
    ReviewNextResponse.parse((await call("GET", "/v1/review/next", ANA)).body);
    ReviewAnswerResponse.parse((await call("POST", "/v1/review/answer", ANA, { itemId: ITEM, correct: false })).body);
    ClassSummary.parse((await call("GET", `/v1/classes/${TURMA}/summary`, PROF)).body);
  });
});
