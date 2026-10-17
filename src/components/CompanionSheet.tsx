import { useLayoutEffect, useRef, type ReactNode } from "react";
import { IconX } from "@tabler/icons-react";
import ModalSheet from "./ModalSheet";

function Content({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useLayoutEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.querySelector<HTMLElement>("button, input, textarea")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close.current(); }
      if (event.key !== "Tab") return;
      const items = Array.from(ref.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), textarea:not(:disabled), a[href]") ?? []);
      const first = items[0]; const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = oldOverflow;
      previous?.focus();
    };
  }, []);
  return <section ref={ref} role="dialog" aria-modal="true" aria-label={title}>
    <div className="flex items-center justify-between gap-3 mb-4">
      <h2 className="text-lg font-semibold text-movenotes-text">{title}</h2>
      <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-black/5" aria-label={`Close ${title}`}><IconX size={20} /></button>
    </div>
    {children}
  </section>;
}

export default function CompanionSheet(props: { title: string; onClose: () => void; children: ReactNode }) {
  return <ModalSheet onClose={props.onClose} sheetClassName="max-w-md sm:max-w-xl max-h-[92dvh] overflow-y-auto">
    <Content {...props} />
  </ModalSheet>;
}
