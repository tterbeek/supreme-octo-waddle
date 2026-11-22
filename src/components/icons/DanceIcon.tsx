export default function DanceIcon({ size = 24, strokeWidth = 2 }: { size?: number; strokeWidth?: number }) {
  return (<svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  <circle cx="12" cy="4.5" r="1.5" fill="currentColor" stroke="none" />
  <path d="M12 8l0 5" />
  <path d="M12 8l-4 2l-3 -1" />
  <path d="M12 8l4 1l3 -4" />
  <path d="M12 13l-3 4l-1 4" />
  <path d="M12 13l4 4l-2 4" />
</svg>);
}
