import { useEffect, useRef, useState } from 'react';
import { IconDotsVertical } from '@tabler/icons-react';

export default function ChallengeActions({ onUpdate }: { onUpdate: () => void }) {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLButtonElement>('[role=menuitem]')?.focus();
    const outside = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  return <div ref={menu} className="relative shrink-0" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button ref={trigger} type="button" aria-label="Challenge actions" aria-haspopup="menu" aria-expanded={open} className="rounded-full p-3 text-gray-500 hover:bg-white/50" onClick={() => setOpen(value => !value)}><IconDotsVertical size={18} /></button>
    {open && <div role="menu" className="absolute right-0 top-full z-10 w-44 rounded-xl border border-warm-200 bg-warm-100 p-1 shadow-lg">
      <button type="button" role="menuitem" className="w-full rounded-lg px-3 py-3 text-left text-sm hover:bg-white/60" onClick={() => { trigger.current?.focus(); setOpen(false); onUpdate(); }}>Update challenge</button>
    </div>}
  </div>;
}
