import { canRunWeeklyNow } from "./companion.ts";

/** Explicit per-request test flag. No environment-wide or persistent switch. */
export function storeCompanionTestRequest(
  user: { id?: string | null; email_confirmed_at?: string | null },
  input: { manual?: unknown; store_test_request?: unknown } | null,
) {
  return canRunWeeklyNow(user) && input?.manual === true && input?.store_test_request === true;
}

export type CompanionRunDiagnostics = {
  request_timestamp: string;
  endpoint: string;
  requested_model: string;
  model: string | null;
  response_id: string | null;
  request_id: string | null;
  project_id: string | null;
  store_requested: true;
  store_returned: boolean | null;
  http_status: number;
};

/** Strict allowlist: never log/return the prompt, output, headers or credentials. */
export function companionRunDiagnostics(timestamp: string, model: string, response: Response, payload: unknown): CompanionRunDiagnostics {
  const value = payload as { id?: unknown; model?: unknown; store?: unknown } | null;
  return {
    request_timestamp: timestamp, endpoint: "https://api.openai.com/v1/responses", requested_model: model,
    model: typeof value?.model === "string" ? value.model : null,
    response_id: typeof value?.id === "string" ? value.id : null,
    request_id: response.headers.get("x-request-id"), project_id: response.headers.get("openai-project"),
    store_requested: true, store_returned: typeof value?.store === "boolean" ? value.store : null,
    http_status: response.status,
  };
}
