import type { ApiError } from "@app/contracts";

type Code = ApiError["error"]["code"];

const STATUS: Record<Code, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  invalid_request: 400,
  quota_exceeded: 429,
  feature_disabled: 403,
  content_blocked: 422,
  internal: 500,
};

export class HttpError extends Error {
  readonly status: number;
  constructor(
    readonly code: Code,
    message: string,
  ) {
    super(message);
    this.status = STATUS[code];
  }
}

export const errorBody = (code: Code, message: string): ApiError => ({ error: { code, message } });
