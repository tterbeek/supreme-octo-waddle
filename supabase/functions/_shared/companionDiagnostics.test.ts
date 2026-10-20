import { describe, expect, it } from "vitest";
import { companionRunDiagnostics, storeCompanionTestRequest } from "./companionDiagnostics";

const owner = { email: "me@thijsterbeek.com", email_confirmed_at: "2026-01-01" };
describe("single-request OpenAI storage for owner testing", () => {
  it("keeps normal, manual-but-unchecked, non-owner and unconfirmed requests unstored", () => {
    expect(storeCompanionTestRequest(owner, null)).toBe(false);
    expect(storeCompanionTestRequest(owner, {})).toBe(false);
    expect(storeCompanionTestRequest(owner, { manual: true })).toBe(false);
    expect(storeCompanionTestRequest(owner, { store_test_request: true })).toBe(false);
    expect(storeCompanionTestRequest(owner, { manual: true, store_test_request: "true" })).toBe(false);
    expect(storeCompanionTestRequest({ email: "other@example.test", email_confirmed_at: "2026-01-01" }, { manual: true, store_test_request: true })).toBe(false);
    expect(storeCompanionTestRequest({ email: owner.email }, { manual: true, store_test_request: true })).toBe(false);
  });
  it("enables storage only for an explicitly selected manual test, not the following run", () => {
    expect(storeCompanionTestRequest(owner, { manual: true, store_test_request: true })).toBe(true);
    expect(storeCompanionTestRequest(owner, { manual: true })).toBe(false);
  });
  it("captures only whitelisted metadata, never request/response content or credentials", () => {
    const result = companionRunDiagnostics("2026-10-20T12:00:00Z", "configured-model", new Response(null, { headers: {
      "x-request-id": "req_test", "openai-project": "proj_test", authorization: "PRIVATE_KEY",
    } }), { id: "resp_test", model: "resolved-model", store: true, input: "PRIVATE_INPUT", output: "PRIVATE_OUTPUT", api_key: "PRIVATE_KEY" });
    expect(result).toMatchObject({ request_id: "req_test", response_id: "resp_test", project_id: "proj_test", model: "resolved-model", store_returned: true });
    expect(JSON.stringify(result)).not.toContain("PRIVATE");
  });
  it("does not invent a project, response ID or storage confirmation when absent", () => {
    expect(companionRunDiagnostics("now", "model", new Response(null, { status: 400 }), null)).toMatchObject({ response_id: null, project_id: null, store_returned: null, http_status: 400 });
  });
});
