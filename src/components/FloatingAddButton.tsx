export default function FloatingAddButton({ onClick, expanded }: { onClick: () => void; expanded?: boolean }) {
  return <button
    type="button" aria-label="Add" aria-haspopup="dialog" aria-expanded={expanded} onClick={onClick}
    className="fixed z-40 rounded-full bg-movenotes-primary text-primary-text shadow-lg shadow-movenotes-primary/30 active:scale-95 transition flex items-center justify-center gap-2 text-lg px-4 h-14 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-movenotes-primary"
    style={{ right: 'calc(16px + env(safe-area-inset-right))', bottom: 'calc(90px + env(safe-area-inset-bottom))' }}
  >
    <span className="text-2xl leading-none" aria-hidden="true">+</span>
    <span className="text-sm font-semibold">Add</span>
  </button>;
}
