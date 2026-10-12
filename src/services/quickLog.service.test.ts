import { beforeEach, describe, expect, it, vi } from "vitest";

const { from, replaceActivityEquipment } = vi.hoisted(() => ({
  from: vi.fn(),
  replaceActivityEquipment: vi.fn(),
}));
vi.mock("../supabaseClient", () => ({ supabase: { from } }));
vi.mock("./equipment.service", () => ({ replaceActivityEquipment }));

import { completeImportedActivity, type SaveQuickLogInput } from "./quickLog.service";

const input: SaveQuickLogInput = {
  userId: "user-1", activityType: "run", date: "2026-10-12",
  distanceValue: 8.4, durationValue: 46, effortValue: 3,
  feelingDuringValue: null, feelingAfterValue: null,
  title: "Morning run", equipmentIds: ["shoes-1"],
};

describe("completeImportedActivity", () => {
  const query = {
    update: vi.fn(), eq: vi.fn(), neq: vi.fn(), select: vi.fn(), maybeSingle: vi.fn(),
  };
  beforeEach(() => {
    for (const fn of Object.values(query)) fn.mockReset().mockReturnValue(query);
    query.maybeSingle.mockResolvedValue({ data: { id: "existing-id" }, error: null });
    from.mockReset().mockReturnValue(query);
    replaceActivityEquipment.mockReset().mockResolvedValue({ error: null });
  });

  it("updates the existing imported row and retains its identity", async () => {
    const result = await completeImportedActivity("existing-id", input, "user-1");
    expect(result).toEqual({ id: "existing-id", error: null });
    expect(from).toHaveBeenCalledWith("activities");
    expect(query.update).toHaveBeenNthCalledWith(1, expect.objectContaining({
      title: "Morning run", distance_km: 8.4,
    }));
    expect(query.update).toHaveBeenNthCalledWith(2, { user_enrichment_status: "completed" });
    expect(query.eq).toHaveBeenCalledWith("id", "existing-id");
    expect(query.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(query.eq).toHaveBeenCalledWith("user_enrichment_status", "pending");
    expect(query.neq).toHaveBeenCalledWith("source", "manual");
    expect(replaceActivityEquipment).toHaveBeenCalledWith("existing-id", ["shoes-1"]);
  });

  it("handles imported values as-is without rewriting workout fields", async () => {
    const result = await completeImportedActivity("existing-id", null, "user-1");
    expect(result.id).toBe("existing-id");
    expect(query.update).toHaveBeenCalledWith({ user_enrichment_status: "completed" });
    expect(replaceActivityEquipment).not.toHaveBeenCalled();
  });

  it("keeps completion pending if equipment saving fails", async () => {
    replaceActivityEquipment.mockResolvedValue({ error: new Error("Equipment link failed") });
    const result = await completeImportedActivity("existing-id", input, "user-1");
    expect(result.error?.message).toBe("Equipment link failed");
    expect(query.update).toHaveBeenCalledTimes(1);
  });
});
