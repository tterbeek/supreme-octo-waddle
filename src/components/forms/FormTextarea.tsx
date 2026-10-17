import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";

/** Text grows with its content; the shell, not a second text region, scrolls. */
const FormTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function FormTextarea({ value, onInput, style, ...props }, forwardedRef) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(forwardedRef, () => ref.current!, []);
  const resize = () => {
    const input = ref.current;
    if (!input || !input.getClientRects().length) return;
    input.style.height = "auto";
    input.style.height = `${input.scrollHeight + 2}px`;
  };
  useLayoutEffect(resize, [value]);
  useLayoutEffect(() => {
    let width = 0;
    const observer = new ResizeObserver(entries => {
      const next = entries[0]?.contentRect.width ?? 0;
      if (next !== width) { width = next; resize(); }
    });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return <textarea {...props} ref={ref} value={value} style={{ ...style, overflowY: "hidden", resize: "none" }} onInput={event => { resize(); onInput?.(event); }} />;
});
export default FormTextarea;
