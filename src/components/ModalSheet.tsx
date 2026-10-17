import { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { formLeaves, lockPageScroll, overlayStack } from "../lib/formLifecycle";
import { useFormDraft } from "../hooks/useFormDraft";
import { useFormLeave } from "../hooks/useFormLeave";
import { DiscardPrompt } from "./forms/FormLayout";
import { FormLayoutContext } from "./forms/formContext";

const OverlayDepth = createContext(0);
const presentationClass = {
  sheet: "mn-overlay-sheet",
  dialog: "mn-overlay-dialog",
  drawer: "mn-overlay-drawer",
  fullscreen: "mn-overlay-fullscreen",
};
export type ModalSheetProps = {
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  dirty?: boolean;
  draft?: unknown;
  ready?: boolean;
  busy?: boolean;
  sheetClassName?: string;
  presentation?: "sheet" | "dialog" | "drawer" | "fullscreen";
  layerDepth?: number;
};

export default function ModalSheet({ title, children, onClose, footer, dirty, draft, ready = true, busy = false, sheetClassName = "max-w-md sm:max-w-xl", presentation = "sheet", layerDepth }: ModalSheetProps) {
  const id = useId(); const parentDepth = useContext(OverlayDepth);
  const depth = layerDepth ?? parentDepth;
  const top = useSyncExternalStore(overlayStack.subscribe, overlayStack.top, () => null);
  const active = top === id;
  const panel = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const backdropStart = useRef(false);
  const [footerElement, setFooterElement] = useState<HTMLElement | null>(null);
  const changes = useFormDraft(draft, ready);
  const hasChanges = dirty ?? changes.dirty;
  const leave = useFormLeave(hasChanges, busy, onClose, depth);
  const confirm = leave.confirm;
  const requestRef = useRef<() => void>(() => {});
  const requestClose = () => {
    if (formLeaves.current()?.busy) return;
    if (confirm) { leave.keep(); return; }
    lastFocus.current = document.activeElement as HTMLElement;
    leave.request();
  };
  requestRef.current = requestClose;

  useLayoutEffect(() => {
    opener.current = document.activeElement as HTMLElement | null;
    const unlock = lockPageScroll();
    overlayStack.add(id, depth);
    return () => {
      overlayStack.remove(id); unlock();
      const previous = opener.current;
      queueMicrotask(() => { if (previous?.isConnected && !previous.closest("[inert]")) previous.focus({ preventScroll: true }); });
    };
  }, [depth, id]);

  useLayoutEffect(() => {
    if (!active) return;
    const el = panel.current;
    // Focus the title/close, not an input: opening a form must not summon a keyboard.
    const target = confirm ? el?.querySelector<HTMLElement>("[data-discard-prompt] button") : el?.querySelector<HTMLElement>("[data-initial-focus]") ?? (lastFocus.current?.isConnected ? lastFocus.current : el?.querySelector<HTMLElement>("[data-overlay-close]"));
    target?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (overlayStack.top() !== id || !el) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); requestRef.current(); }
      if (event.key !== "Tab") return;
      const items = Array.from(el.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]')).filter(item => !item.closest("[inert]") && item.getClientRects().length);
      const first = items[0]; const last = items.at(-1);
      if (!first) { event.preventDefault(); el.focus(); }
      else if (event.shiftKey && (document.activeElement === first || !el.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !el.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    const onFocus = (event: FocusEvent) => {
      if (overlayStack.top() !== id) return;
      // Native date/select/photo pickers keep focus in their originating control.
      if (event.target instanceof Node && !el?.contains(event.target)) el?.querySelector<HTMLElement>("[data-overlay-close]")?.focus({ preventScroll: true });
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("focusin", onFocus);
    return () => { document.removeEventListener("keydown", onKey, true); document.removeEventListener("focusin", onFocus); };
  }, [active, confirm, id]);

  useEffect(() => {
    const updateViewport = () => {
      const viewport = window.visualViewport;
      const layer = panel.current?.parentElement;
      if (layer) {
        layer.style.setProperty("--overlay-height", `${viewport?.height ?? window.innerHeight}px`);
        layer.style.setProperty("--overlay-top", `${viewport?.offsetTop ?? 0}px`);
      }
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && body.current?.contains(focused)) focused.scrollIntoView({ block: "nearest" });
    };
    updateViewport();
    window.visualViewport?.addEventListener("resize", updateViewport);
    window.visualViewport?.addEventListener("scroll", updateViewport);
    window.addEventListener("resize", updateViewport);
    return () => { window.visualViewport?.removeEventListener("resize", updateViewport); window.visualViewport?.removeEventListener("scroll", updateViewport); window.removeEventListener("resize", updateViewport); };
  }, []);

  return createPortal(<OverlayDepth.Provider value={depth + 1}>
    <div className={`mn-overlay ${presentationClass[presentation]}`} style={{ visibility: active ? "visible" : "hidden", zIndex: 100 + depth }} aria-hidden={!active} inert={!active}
      onPointerDown={event => { backdropStart.current = event.target === event.currentTarget; }}
      onClick={event => { event.stopPropagation(); if (backdropStart.current && event.target === event.currentTarget) requestClose(); }}>
      <div ref={panel} role="dialog" aria-modal={active || undefined} aria-labelledby={`${id}-title`} aria-busy={busy} tabIndex={-1} className={`mn-form-panel ${sheetClassName}`} onClick={event => event.stopPropagation()}>
        <header className="mn-form-header"><h2 id={`${id}-title`}>{confirm ? "Unsaved changes" : title}</h2>
          <button type="button" data-overlay-close aria-label={`Close ${title}`} onClick={requestClose} disabled={busy} className="mn-close"><X size={22} /></button>
        </header>
        {confirm && <div className="mn-form-body" data-discard-prompt><DiscardPrompt keep={leave.keep} discard={leave.discard} /></div>}
        <FormLayoutContext.Provider value={{ footer: footerElement, dismiss: requestClose }}>
          <div ref={body} className="mn-form-body" hidden={confirm} inert={confirm}><fieldset disabled={busy || !ready} className="contents">{children}</fieldset></div>
          <footer ref={setFooterElement} className="mn-form-footer" hidden={confirm}>{footer}</footer>
        </FormLayoutContext.Provider>
        {busy && <span className="sr-only" role="status">Please wait while saving.</span>}
      </div>
    </div>
  </OverlayDepth.Provider>, document.body);
}
