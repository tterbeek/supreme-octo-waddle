import { beforeEach, describe, expect, it, vi } from "vitest";
const { invoke, rpc } = vi.hoisted(() => ({ invoke: vi.fn(), rpc: vi.fn() }));
vi.mock("../supabaseClient", () => ({ supabase: { functions: { invoke }, rpc } }));
import { deleteCompanionPost, ensureWeeklyCompanion } from "./companion.service";

beforeEach(() => { vi.clearAllMocks(); invoke.mockResolvedValue({ data: { status: "ready" }, error: null }); rpc.mockResolvedValue({ error: null }); });

describe("explicit weekly actions", () => {
  it("keeps ordinary Journal requests non-forcing; only explicit admin requests set manual", async () => {
    await ensureWeeklyCompanion();
    expect(invoke).toHaveBeenNthCalledWith(1, "weekly-companion", { body: {} });
    await ensureWeeklyCompanion({ manual: true });
    expect(invoke).toHaveBeenNthCalledWith(2, "weekly-companion", { body: { manual: true } });
  });
  it("deletes only the selected output via the authenticated RPC, never regenerating it", async () => {
    await deleteCompanionPost("post", "2026-10-18T10:00:00.123456+00:00");
    expect(rpc).toHaveBeenCalledWith("delete_companion_post", { p_post_id: "post", p_generated_at: "2026-10-18T10:00:00.123456+00:00" });
    expect(invoke).not.toHaveBeenCalled();
  });
  it("sends the storage flag only for an explicitly chosen manual test", async () => {
    await ensureWeeklyCompanion({ manual: true, storeTestRequest: true });
    expect(invoke).toHaveBeenNthCalledWith(1, "weekly-companion", { body: { manual: true, store_test_request: true } });
    await ensureWeeklyCompanion({ manual: false, storeTestRequest: true });
    expect(invoke).toHaveBeenNthCalledWith(2, "weekly-companion", { body: {} });
    await ensureWeeklyCompanion({ manual: true });
    expect(invoke).toHaveBeenNthCalledWith(3, "weekly-companion", { body: { manual: true } });
  });
  it("surfaces a failed deletion for retry without issuing generation", async () => {
    rpc.mockResolvedValueOnce({ error: new Error("failed") });
    await expect(deleteCompanionPost("post", null)).rejects.toThrow("failed");
    await expect(deleteCompanionPost("post", null)).resolves.toBeUndefined();
    expect(invoke).not.toHaveBeenCalled();
  });
});
