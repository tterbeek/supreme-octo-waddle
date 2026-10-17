import { useContext, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { FormLayoutContext } from "./formContext";

/** Keep only the primary action here. It is portalled into the shell's compact footer. */
export function FormActions({ children }: { children: ReactNode }) {
  const layout = useContext(FormLayoutContext);
  return layout?.footer ? createPortal(<div className="mn-form-actions">{children}</div>, layout.footer) : null;
}
export function FormCancel({ children = "Cancel", disabled = false }: { children?: ReactNode; disabled?: boolean }) {
  const layout = useContext(FormLayoutContext);
  return <button type="button" disabled={disabled} onClick={() => layout?.dismiss()} className="mn-form-cancel">{children}</button>;
}
export function FormField({ label, help, error, children }: { label: string; help?: string; error?: string | null; children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: true }) => ReactNode }) {
  const id = useId();
  return <div className="mn-field"><label htmlFor={id}>{label}</label>
    {children({ id, "aria-describedby": help || error ? `${id}-help` : undefined, "aria-invalid": error ? true : undefined })}
    {(error || help) && <p id={`${id}-help`} role={error ? "alert" : undefined} className={error ? "mn-error" : "mn-help"}>{error || help}</p>}
  </div>;
}
export function FormError({ children }: { children?: ReactNode }) {
  return children ? <p role="alert" className="mn-error">{children}</p> : null;
}
export function DiscardPrompt({ keep, discard }: { keep: () => void; discard: () => void }) {
  return <div className="space-y-4" role="alert" aria-label="Unsaved changes">
    <p>You have unsaved changes. Keep editing, or discard only these changes.</p>
    <button type="button" onClick={keep} data-initial-focus className="mn-primary w-full">Keep editing</button>
    <button type="button" onClick={discard} className="mn-form-cancel text-movenotes-accent">Discard changes</button>
  </div>;
}
