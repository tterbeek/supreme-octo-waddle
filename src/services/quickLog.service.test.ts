import { beforeEach, describe, expect, it, vi } from "vitest";

const { from, rpc, replaceActivityEquipment } = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  replaceActivityEquipment: vi.fn(),
}));
vi.mock("../supabaseClient", () => ({ supabase: { from, rpc } }));
vi.mock("./equipment.service", () => ({ replaceActivityEquipment }));

import { completeImportedActivity, createPresetFromActivity, saveQuickLog, type SaveQuickLogInput } from "./quickLog.service";

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

describe("preset route snapshots", () => {
  const route = "_p~iF~ps|U_ulLnnqC_mqNvxq" + String.fromCharCode(96) + "@";
  beforeEach(() => {
    from.mockReset();
    rpc.mockReset();
    replaceActivityEquipment.mockReset().mockResolvedValue({ error: null });
  });
  it("uses the owner-authorized atomic snapshot for route and equipment", async () => {
    rpc.mockResolvedValue({ data: "preset-id", error: null });
    const result = await createPresetFromActivity({
      activityId: "existing-id", userId: "user-1", activityType: "run", name: "Regular route",
      distanceValue: 5, durationValue: 30, effortValue: 2,
    });
    expect(result.error).toBeNull();
    expect(rpc).toHaveBeenCalledWith("create_activity_preset", { p_activity: "existing-id", p_name: "Regular route" });
    expect(from).not.toHaveBeenCalled();
  });
  it("reports snapshot errors without attempting a partial client-side preset", async () => {
    const error = new Error("Equipment link failed");
    rpc.mockResolvedValue({ data: null, error });
    const result = await createPresetFromActivity({
      activityId: "existing-id", userId: "user-1", activityType: "run", name: "Regular route",
      distanceValue: 5, durationValue: 30, effortValue: null,
    });
    expect(result.error).toBe(error);
    expect(from).not.toHaveBeenCalled();
  });
  it.each([route, null])("copies only the selected preset route onto a new manual activity: %s", async routePolyline => {
    const query = { insert: vi.fn(), select: vi.fn(), single: vi.fn().mockResolvedValue({ data: { id: "new-id" }, error: null }) };
    query.insert.mockReturnValue(query); query.select.mockReturnValue(query);
    from.mockReturnValue(query);
    expect((await saveQuickLog({ ...input, routePolyline, equipmentIds: [] })).id).toBe("new-id");
    const saved = query.insert.mock.calls[0][0][0];
    expect(saved.route_polyline).toBe(routePolyline);
    expect(saved).not.toHaveProperty("external_id");
    expect(saved).not.toHaveProperty("external_source");
    expect(saved).not.toHaveProperty("source");
  });
});
