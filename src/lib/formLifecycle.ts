export type DismissDecision = "close" | "confirm" | "wait";
export function dismissDecision(dirty: boolean, busy: boolean): DismissDecision {
  return busy ? "wait" : dirty ? "confirm" : "close";
}

export function draftSnapshot(value: unknown): string {
  return JSON.stringify(value, (_key, item) => typeof File !== "undefined" && item instanceof File
    ? { name: item.name, size: item.size, lastModified: item.lastModified, type: item.type }
    : item) ?? "";
}

/** One registry for nested sheets, drawers and full-screen onboarding. */
export function createOverlayStack() {
  let entries: { id: string; depth: number; order: number }[] = [];
  let order = 0;
  let top: string | null = null;
  const listeners = new Set<() => void>();
  const publish = () => {
    top = [...entries].sort((a, b) => a.depth - b.depth || a.order - b.order).at(-1)?.id ?? null;
    listeners.forEach(listener => listener());
  };
  return {
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    top: () => top,
    add: (id: string, depth: number) => { entries = entries.filter(e => e.id !== id); entries.push({ id, depth, order: ++order }); publish(); },
    remove: (id: string) => { entries = entries.filter(e => e.id !== id); publish(); },
    count: () => entries.length,
  };
}

export const overlayStack = createOverlayStack();
type LeaveEntry = { id: string; priority: number; dirty: boolean; busy: boolean; request: (proceed: () => void, cancel: () => void) => void };
const leaveEntries = new Map<string, LeaveEntry>();
let navigationAllowed = false;
export function allowFormNavigation(action: () => void) {
  navigationAllowed = true;
  try { action(); } finally { navigationAllowed = false; }
}
export const formLeaves = {
  set: (entry: LeaveEntry) => { leaveEntries.set(entry.id, entry); },
  remove: (id: string) => { leaveEntries.delete(id); },
  current: () => navigationAllowed ? undefined : [...leaveEntries.values()].filter(e => e.dirty || e.busy).sort((a, b) => Number(a.busy) - Number(b.busy) || a.priority - b.priority).at(-1),
};
let locks = 0;
let restoreBody: (() => void) | null = null;
/** Reference-counted, position-preserving lock; handoffs within a commit don't unlock. */
export function lockPageScroll() {
  if (locks++ === 0 && !restoreBody) {
    const { body, documentElement } = document;
    const x = window.scrollX; const y = window.scrollY;
    const properties = ["position", "top", "left", "right", "width", "overflow", "paddingRight"] as const;
    const previous = Object.fromEntries(properties.map(key => [key, body.style[key]]));
    const previousRootOverflow = documentElement.style.overflow;
    const app = document.getElementById("root");
    const previousInert = app?.inert ?? false;
    if (app) app.inert = true;
    const gutter = Math.max(0, window.innerWidth - documentElement.clientWidth);
    Object.assign(body.style, { position: "fixed", top: `${-y}px`, left: "0", right: "0", width: "100%", overflow: "hidden" });
    if (gutter) body.style.paddingRight = `${gutter}px`;
    documentElement.style.overflow = "hidden";
    restoreBody = () => {
      Object.assign(body.style, previous);
      documentElement.style.overflow = previousRootOverflow;
      if (app) app.inert = previousInert;
      window.scrollTo(x, y);
    };
  }
  let released = false;
  return () => {
    if (released) return;
    released = true; locks--;
    queueMicrotask(() => { if (locks === 0) { restoreBody?.(); restoreBody = null; } });
  };
}
