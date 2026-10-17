import { useNavigate } from "react-router-dom";
import { useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import ModalSheet from "../ModalSheet";
import { useFormLeave } from "../../hooks/useFormLeave";
import { DiscardPrompt } from "./FormLayout";
import { FormLayoutContext } from "./formContext";

export default function FormPage({ title, backTo = "/settings", dirty = false, busy = false, ready = true, children, embedded = false }: { title: string; backTo?: string; dirty?: boolean; busy?: boolean; ready?: boolean; children: ReactNode; embedded?: boolean }) {
  const navigate = useNavigate();
  const leave = useFormLeave(dirty, busy, () => navigate(backTo));
  const [footer, setFooter] = useState<HTMLElement | null>(null);
  return <section className={`mn-page-form ${embedded ? "!p-0" : ""}`} aria-label={title} aria-busy={busy}>
    {!embedded && <header className="mn-page-form-header"><button type="button" aria-label={`Back from ${title}`} disabled={busy} className="mn-close" onClick={() => leave.request()}><ArrowLeft size={22} /></button><h1>{title}</h1></header>}
    <FormLayoutContext.Provider value={{ footer, dismiss: () => leave.request() }}>
      <fieldset disabled={busy || !ready} className="contents">{children}</fieldset>
      <div ref={setFooter} className="mn-page-actions" />
    </FormLayoutContext.Provider>
    {leave.confirm && <ModalSheet title="Unsaved changes" onClose={leave.keep} presentation="dialog"><DiscardPrompt keep={leave.keep} discard={leave.discard} /></ModalSheet>}
  </section>;
}
