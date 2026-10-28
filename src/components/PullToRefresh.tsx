import { useEffect, useRef, useState, type ReactNode } from 'react';
import { IconArrowDown, IconRefresh } from '@tabler/icons-react';

const THRESHOLD = 64;

export default function PullToRefresh({ children, onRefresh, disabled = false }: {
  children: ReactNode; onRefresh: () => Promise<void>; disabled?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const refreshing = useRef(false);
  const [busy, setBusy] = useState(false);
  const [distance, setDistance] = useState(0);
  const [message, setMessage] = useState('');
  const callback = useRef(onRefresh);
  useEffect(() => { callback.current = onRefresh; }, [onRefresh]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 10_000);
    return () => clearTimeout(timer);
  }, [message]);

  async function refresh() {
    if (refreshing.current || disabled) return;
    refreshing.current = true;
    setBusy(true); setDistance(0); setMessage('');
    try { await callback.current(); setMessage('Journal refreshed'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not refresh. Please try again.'); }
    finally { refreshing.current = false; setBusy(false); }
  }
  const run = useRef(refresh);
  useEffect(() => { run.current = refresh; });

  useEffect(() => {
    const element = root.current;
    if (!element || disabled) return;
    let start: { x: number; y: number } | null = null;
    let pull = 0;
    const atTop = () => window.scrollY <= 0 && (document.scrollingElement?.scrollTop ?? 0) <= 0;
    const startTouch = (event: TouchEvent) => {
      start = null; pull = 0;
      if (refreshing.current || event.touches.length !== 1 || !atTop() || document.querySelector('[aria-modal="true"]')) return;
      const target = event.target as HTMLElement;
      if (target.closest('input,textarea,select,button,a,[contenteditable="true"],[data-swipe-ignore]')) return;
      // Nested controls keep their own scrolling/gestures.
      for (let node = target; node && node !== element; node = node.parentElement!) {
        if (node.scrollHeight > node.clientHeight && /auto|scroll/.test(getComputedStyle(node).overflowY)) return;
      }
      start = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    };
    const move = (event: TouchEvent) => {
      if (!start) return;
      if (event.touches.length !== 1 || !atTop()) { start = null; pull = 0; setDistance(0); return; }
      const dy = event.touches[0].clientY - start.y;
      const dx = Math.abs(event.touches[0].clientX - start.x);
      if (dy < 0 || (dx > 10 && dx > dy)) { start = null; pull = 0; setDistance(0); return; }
      if (dy < 8) return;
      if (event.cancelable) event.preventDefault();
      pull = Math.min(84, dy * 0.5);
      setDistance(pull); setMessage('');
    };
    const end = () => {
      const shouldRefresh = start && pull >= THRESHOLD;
      start = null; pull = 0; setDistance(0);
      if (shouldRefresh) void run.current();
    };
    const cancel = () => { start = null; pull = 0; setDistance(0); };
    const previous = [document.documentElement.style.overscrollBehaviorY, document.body.style.overscrollBehaviorY];
    document.documentElement.style.overscrollBehaviorY = 'contain';
    document.body.style.overscrollBehaviorY = 'contain';
    element.addEventListener('touchstart', startTouch, { passive: true });
    element.addEventListener('touchmove', move, { passive: false });
    element.addEventListener('touchend', end);
    element.addEventListener('touchcancel', cancel);
    return () => {
      document.documentElement.style.overscrollBehaviorY = previous[0];
      document.body.style.overscrollBehaviorY = previous[1];
      element.removeEventListener('touchstart', startTouch);
      element.removeEventListener('touchmove', move);
      element.removeEventListener('touchend', end);
      element.removeEventListener('touchcancel', cancel);
    };
  }, [disabled]);

  const failed = Boolean(message && message !== 'Journal refreshed');
  return <div ref={root} className="relative">
    {(busy || distance > 0 || failed) && <div
      data-refresh-indicator
      className={`pointer-events-none absolute top-1 z-30 flex max-w-full items-center gap-2 rounded-xl bg-movenotes-bg/95 px-3 py-2 text-sm text-movenotes-primary shadow-sm ${busy || failed ? 'right-1' : 'left-1/2 -translate-x-1/2'}`}
      aria-hidden="true"
    >
      {busy ? <IconRefresh size={19} className="shrink-0 animate-spin motion-reduce:animate-none" /> : !failed && <IconArrowDown size={19} className={`shrink-0 ${distance >= THRESHOLD ? 'rotate-180' : ''}`} />}
      <span>{busy ? 'Checking for activities…' : failed ? message : distance >= THRESHOLD ? 'Release to refresh' : 'Pull to refresh'}</span>
    </div>}
    <span role="status" className="sr-only">{busy ? 'Checking for activities…' : message}</span>
    <button type="button" onClick={() => void refresh()} disabled={disabled || busy} aria-label="Refresh Journal" className="sr-only focus:not-sr-only focus:absolute focus:right-1 focus:top-1 focus:z-30 focus:rounded-lg focus:bg-movenotes-bg focus:p-3">Refresh Journal</button>
    {children}
  </div>;
}
