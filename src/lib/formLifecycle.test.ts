import { afterEach, describe, expect, it, vi } from "vitest";
import { allowFormNavigation, createOverlayStack, dismissDecision, draftSnapshot, formLeaves, lockPageScroll } from "./formLifecycle";

afterEach(() => { vi.unstubAllGlobals(); });
describe("form dismissal", () => {
  it("closes unchanged forms, protects edits, and waits during writes", () => {
    expect(dismissDecision(false, false)).toBe("close");
    expect(dismissDecision(true, false)).toBe("confirm");
    expect(dismissDecision(false, true)).toBe("wait");
    expect(dismissDecision(true, true)).toBe("wait");
  });
  it("compares saved values, not interaction or expanded sections", () => {
    const original = { title: "Walk", note: "", equipment: ["shoes"] };
    expect(draftSnapshot({ ...original })).toBe(draftSnapshot(original));
    expect(draftSnapshot({ ...original, note: "Changed" })).not.toBe(draftSnapshot(original));
    const photo = new File(["image"], "walk.jpg", { lastModified: 10 });
    expect(draftSnapshot([photo])).toContain('"lastModified":10');
    expect(draftSnapshot([photo])).not.toBe(draftSnapshot([]));
  });
  it("allows only explicit completed-save navigation, without forgetting other forms", () => {
    formLeaves.set({ id: "page", priority: -1, dirty: true, busy: false, request: vi.fn() });
    expect(formLeaves.current()?.id).toBe("page");
    allowFormNavigation(() => { expect(formLeaves.current()).toBeUndefined(); });
    expect(formLeaves.current()?.id).toBe("page");
    formLeaves.remove("page");
    expect(formLeaves.current()).toBeUndefined();
  });
  it("prioritises any in-flight write over another dirty form", () => {
    formLeaves.set({ id: "saving", priority: 0, dirty: false, busy: true, request: vi.fn() });
    formLeaves.set({ id: "dirty", priority: 10, dirty: true, busy: false, request: vi.fn() });
    expect(formLeaves.current()?.id).toBe("saving");
    formLeaves.remove("saving"); formLeaves.remove("dirty");
  });
});

describe("overlay ownership", () => {
  it("shows only the deepest/latest overlay and restores its parent", () => {
    const stack = createOverlayStack(); const listener = vi.fn(); const unsubscribe = stack.subscribe(listener);
    stack.add("parent", 0); stack.add("child", 1); stack.add("sibling", 0);
    expect(stack.top()).toBe("child");
    stack.remove("child"); expect(stack.top()).toBe("sibling");
    stack.remove("sibling"); expect(stack.top()).toBe("parent");
    stack.remove("parent"); expect(stack.top()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(6); unsubscribe();
  });
  it("is stable when StrictMode registers the same id again", () => {
    const stack = createOverlayStack(); stack.add("sheet", 0); stack.add("sheet", 0);
    expect(stack.count()).toBe(1); stack.remove("sheet"); expect(stack.count()).toBe(0);
  });
});

describe("page scroll lock", () => {
  it("keeps one lock through nested overlays and restores styles, inertness and exact position", async () => {
    const style = { position: "relative", top: "", left: "", right: "", width: "", overflow: "auto", paddingRight: "3px" };
    const app = { inert: false }; const rootStyle = { overflow: "" }; const scrollTo = vi.fn();
    vi.stubGlobal("document", { body: { style }, documentElement: { style: rootStyle, clientWidth: 1000 }, getElementById: () => app });
    vi.stubGlobal("window", { scrollX: 8, scrollY: 520, innerWidth: 1024, scrollTo });
    const releaseParent = lockPageScroll(); const releaseChild = lockPageScroll();
    expect(style.position).toBe("fixed"); expect(style.top).toBe("-520px"); expect(app.inert).toBe(true);
    releaseParent(); await Promise.resolve(); expect(style.position).toBe("fixed");
    releaseChild(); releaseChild(); await Promise.resolve();
    expect(style.position).toBe("relative"); expect(style.overflow).toBe("auto"); expect(style.paddingRight).toBe("3px");
    expect(rootStyle.overflow).toBe(""); expect(app.inert).toBe(false); expect(scrollTo).toHaveBeenCalledExactlyOnceWith(8, 520);
  });
  it("does not unlock the page between a same-tick overlay handoff", async () => {
    const style = { position: "", top: "", left: "", right: "", width: "", overflow: "", paddingRight: "" };
    const scrollTo = vi.fn();
    vi.stubGlobal("document", { body: { style }, documentElement: { style: { overflow: "" }, clientWidth: 390 }, getElementById: () => null });
    vi.stubGlobal("window", { scrollX: 0, scrollY: 70, innerWidth: 390, scrollTo });
    const first = lockPageScroll(); first(); const second = lockPageScroll();
    await Promise.resolve(); expect(style.position).toBe("fixed"); expect(scrollTo).not.toHaveBeenCalled();
    second(); await Promise.resolve(); expect(style.position).toBe(""); expect(scrollTo).toHaveBeenCalledWith(0, 70);
  });
});
