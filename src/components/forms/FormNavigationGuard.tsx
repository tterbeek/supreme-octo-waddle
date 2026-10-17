import { useEffect } from "react";
import { useBlocker } from "react-router-dom";
import { formLeaves } from "../../lib/formLifecycle";
import ModalSheet from "../ModalSheet";
import { DiscardPrompt } from "./FormLayout";

export default function FormNavigationGuard() {
  const blocker = useBlocker(() => Boolean(formLeaves.current()));
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    if (formLeaves.current()?.busy) blocker.reset();
  }, [blocker]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (formLeaves.current()) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);
  return blocker.state === "blocked" && !formLeaves.current()?.busy ? <ModalSheet title="Unsaved changes" presentation="dialog" layerDepth={10000} onClose={() => blocker.reset()}>
    <DiscardPrompt keep={() => blocker.reset()} discard={() => blocker.proceed()} />
  </ModalSheet> : null;
}
