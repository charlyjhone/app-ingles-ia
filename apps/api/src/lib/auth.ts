import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { HttpError } from "./errors";

/** Verifica o token emitido pelo Supabase Auth e devolve o id do usuário. */
export type TokenVerifier = (token: string) => Promise<{ userId: string }>;

export function supabaseTokenVerifier(opts: { supabaseUrl: string; jwtSecret?: string }): TokenVerifier {
  const issuer = `${opts.supabaseUrl}/auth/v1`;
  // Projetos novos do Supabase usam chaves assimétricas (JWKS); antigos, segredo HS256.
  const key = opts.jwtSecret
    ? new TextEncoder().encode(opts.jwtSecret)
    : createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));

  return async (token) => {
    let payload: JWTPayload;
    try {
      ({ payload } =
        key instanceof Uint8Array
          ? await jwtVerify(token, key, { issuer, audience: "authenticated" })
          : await jwtVerify(token, key, { issuer, audience: "authenticated" }));
    } catch {
      throw new HttpError("unauthorized", "Sessão inválida ou expirada");
    }
    if (!payload.sub) throw new HttpError("unauthorized", "Token sem usuário");
    return { userId: payload.sub };
  };
}

export function bearer(header: string | undefined): string {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) throw new HttpError("unauthorized", "Faça login para continuar");
  return match[1];
}
