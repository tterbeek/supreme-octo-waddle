import { beforeEach, describe, expect, it, vi } from "vitest";
const { from, rpc } = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("../supabaseClient", () => ({ supabase: { from, rpc } }));
import { fetchCompanionFeedback, removeCompanionFeedback, saveCompanionFeedback } from "./companionFeedback.service";

describe("Companion feedback persistence", () => {
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), delete: vi.fn() };
  const version = "2026-10-18T10:00:00.123456+00:00";
  beforeEach(() => {
    vi.clearAllMocks();
    Object.values(query).forEach(fn => fn.mockReturnValue(query));
    query.maybeSingle.mockResolvedValue({ data: null, error: null });
    from.mockReturnValue(query);
    rpc.mockResolvedValue({ data: { post_id: "post", output_generated_at: version, rating: "yes", comment: null }, error: null });
  });
  it("loads the exact output version without rounding its timestamp", async () => {
    await fetchCompanionFeedback("post", version);
    expect(from).toHaveBeenCalledWith("companion_feedback");
    expect(query.eq).toHaveBeenCalledWith("output_generated_at", version);
  });
  it("rating taps never save a draft comment or accept a client-supplied user ID", async () => {
    await saveCompanionFeedback("post", version, "not_really");
    expect(rpc).toHaveBeenCalledWith("save_companion_feedback", {
      p_post_id: "post", p_output_generated_at: version, p_rating: "not_really", p_comment: null, p_save_comment: false,
    });
  });
  it("explicit Save feedback trims and can clear the comment", async () => {
    await saveCompanionFeedback("post", version, "yes", " Shorter please ");
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_comment: "Shorter please", p_save_comment: true });
    await saveCompanionFeedback("post", version, "yes", " ");
    expect(rpc.mock.calls[1][1]).toMatchObject({ p_comment: null, p_save_comment: true });
    await expect(saveCompanionFeedback("post", version, "yes", "x".repeat(301))).rejects.toThrow("300");
    expect(rpc).toHaveBeenCalledTimes(2);
  });
  it("removes only feedback on the chosen version, never journal reflections", async () => {
    query.eq.mockReturnValueOnce(query).mockResolvedValueOnce({ error: null });
    await removeCompanionFeedback("post", version);
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("companion_feedback");
    expect(query.eq).toHaveBeenCalledWith("post_id", "post");
    expect(query.eq).toHaveBeenCalledWith("output_generated_at", version);
  });
  it("surfaces save failures for retry without invoking generation", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error("failed") });
    await expect(saveCompanionFeedback("post", version, "yes")).rejects.toThrow("failed");
    await expect(saveCompanionFeedback("post", version, "yes")).resolves.toMatchObject({ rating: "yes" });
    expect(rpc.mock.calls.every(([name]) => name === "save_companion_feedback")).toBe(true);
  });
});
