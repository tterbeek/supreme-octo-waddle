import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { canRunWeeklyNow } from "../../supabase/functions/_shared/companion";
import { ensureWeeklyCompanion, type CompanionRunDiagnostics } from "../services/companion.service";
import CompanionSheet from "./CompanionSheet";
import { FormActions, FormCancel, FormError } from "./forms/FormLayout";

export default function AdminWeeklyCompanion() {
  const [allowed, setAllowed] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [storeTestRequest, setStoreTestRequest] = useState(false);
  const [diagnostics, setDiagnostics] = useState<CompanionRunDiagnostics | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getUser().then(({ data }) => { if (!cancelled) setAllowed(Boolean(data.user && canRunWeeklyNow(data.user))); });
    return () => { cancelled = true; };
  }, []);
  if (!allowed) return null;
  const run = async () => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(null); setMessage(null); setDiagnostics(null);
    try {
      const result = await ensureWeeklyCompanion({ manual: true, storeTestRequest });
      setDiagnostics(result.diagnostics ?? null);
      if (result.status === "ready") { setMessage("Weekly thought ready. Open Journal to view it."); setOpen(false); }
      else if (result.status === "disabled") setError("Enable Weekly Companion in Settings first. Your settings were not changed.");
      else if (result.status === "waiting") setMessage("A weekly run is already in progress. Please wait before trying again.");
      else setError("The run was cancelled because consent changed or the thought was deleted. Please check Journal before retrying.");
    } catch { setError("Couldn't run the weekly thought. Please try again. Any existing thought has been kept."); }
    finally { pending.current = false; setBusy(false); }
  };
  return <section className="rounded-xl border border-warm-200 bg-warm-100 p-5 space-y-3" aria-labelledby="admin-weekly-title">
    <h2 id="admin-weekly-title" className="text-lg font-semibold">Weekly Companion</h2>
    <p className="text-sm text-gray-600">For your owner account only. Run the most recent completed Monday–Sunday now, using the latest eligible feedback. This does not change the normal weekly timing.</p>
    <button type="button" className="mn-primary px-5 py-3" disabled={busy} onClick={() => { setError(null); setMessage(null); setStoreTestRequest(false); setOpen(true); }}>Run weekly now</button>
    {!open && message && <p role="status" className="text-sm">{message}</p>}
    {!open && diagnostics && <div className="text-xs space-y-1 break-words" aria-label="OpenAI test request details">
      <p>Test request sent: {diagnostics.request_timestamp}</p>
      <p>Model: {diagnostics.model ?? diagnostics.requested_model}</p>
      <p>Response ID: {diagnostics.response_id ?? "Not returned"}</p>
      <p>Request ID: {diagnostics.request_id ?? "Not returned"}</p>
      <p>OpenAI project ID: {diagnostics.project_id ?? "Not returned by OpenAI; check your API key's project."}</p>
      <p>{diagnostics.store_returned === true ? "OpenAI confirmed store: true. Find this response in your OpenAI project logs." : "store: true was requested; storage was not confirmed by the response."}</p>
    </div>}
    {open && <CompanionSheet title="Run weekly now?" busy={busy} onClose={() => setOpen(false)}>
      <p>This makes a paid AI call for your account. If a thought already exists for the most recent completed week, it will be replaced only when the new thought succeeds. Your written reflection is kept. Previous feedback remains tied to the old output, not the replacement.</p>
      <label className="mt-4 flex items-start gap-3 text-sm"><input type="checkbox" checked={storeTestRequest} disabled={busy} onChange={event => setStoreTestRequest(event.target.checked)} aria-describedby="stored-test-help" className="mt-1" /><span>Store the complete request and response in OpenAI for this test</span></label>
      <p id="stored-test-help" className="mt-2 text-xs text-gray-600">Includes the prompt and all context sent, including permitted private notes and reflections. Only this manual run is stored; the option resets next time. Credentials are not logged.</p>
      <FormError>{error}</FormError>
      {message && <p role="status" className="mt-3 text-sm">{message}</p>}
      <FormCancel disabled={busy}>Cancel</FormCancel>
      <FormActions><button type="button" className="mn-primary w-full" disabled={busy} onClick={() => void run()}>{busy ? "Preparing weekly thought…" : "Run weekly now"}</button></FormActions>
    </CompanionSheet>}
  </section>;
}
