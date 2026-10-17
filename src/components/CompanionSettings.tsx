import { useEffect, useState } from "react";
import CompanionSheet from "./CompanionSheet";
import { FormActions } from "./forms/FormLayout";
import { getCurrentUser } from "../services/auth.service";
import {
  defaultCompanionPreferences, fetchCompanionPreferences, saveCompanionPreferences, fetchCompanionAccess,
  type CompanionPreferences,
} from "../services/companion.service";

export default function CompanionSettings({ onClose }: { onClose: () => void }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<CompanionPreferences>(defaultCompanionPreferences);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const user = await getCurrentUser();
        if (!user) throw new Error("Please sign in to change Companion settings.");
        const access = await fetchCompanionAccess();
        if (cancelled) return;
        setAllowed(access);
        if (!access) return;
        const prefs = await fetchCompanionPreferences(user.id);
        if (!cancelled) { setUserId(user.id); setPreferences(prefs); }
      } catch { if (!cancelled) setError("Couldn't load Companion settings. Please try again."); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const update = async (key: "enabled" | "allow_activity_notes", value: boolean) => {
    if (!allowed || !userId || saving) return;
    const previous = preferences;
    const next = { ...preferences, [key]: value, time_zone: defaultCompanionPreferences().time_zone };
    setPreferences(next); setSaving(true); setError(null);
    try { await saveCompanionPreferences(userId, next); }
    catch { setPreferences(previous); setError("Couldn't save your settings. Please try again."); }
    finally { setSaving(false); }
  };

  return <CompanionSheet title="Weekly Companion" busy={saving} onClose={onClose}>
    <span className="inline-block mb-3 rounded-full border border-movenotes-primary/30 px-2 py-0.5 text-xs text-movenotes-primary">Premium</span>
    <p className="text-sm text-movenotes-text/70 mb-5">A private thought in your Journal each week. Reflect on it if you wish, or leave it unanswered.</p>
    {!loading && !allowed && <p className="text-sm text-movenotes-text/60 mb-4">Premium feature · Currently available to selected accounts.</p>}
    <div className={`space-y-3 ${!allowed ? "opacity-50" : ""}`}>
      <label className="flex items-start justify-between gap-4 rounded-xl border border-warm-200 bg-movenotes-surface p-4">
        <span><span className="block font-medium">Weekly Companion</span><span className="block mt-1 text-sm text-movenotes-text/65">Use your Directions, Tiny Tweak, last tweak reflection and weekly activity details to write a thought with OpenAI.</span></span>
        <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[#5A7A69]" checked={preferences.enabled} onChange={(event) => void update("enabled", event.target.checked)} disabled={loading || saving || !userId} />
      </label>
      <label className="flex items-start justify-between gap-4 rounded-xl border border-warm-200 bg-movenotes-surface p-4">
        <span><span className="block font-medium">Use private activity notes</span><span className="block mt-1 text-sm text-movenotes-text/65">Also let OpenAI use the notes you wrote on that week's activities. Off by default.</span></span>
        <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-[#5A7A69]" checked={preferences.allow_activity_notes} onChange={(event) => void update("allow_activity_notes", event.target.checked)} disabled={loading || saving || !userId} />
      </label>
    </div>
    <p className="mt-4 text-xs leading-relaxed text-movenotes-text/60">Turning Companion off hides its posts and keeps your responses. Turning note use off removes earlier thoughts that used those notes; your own responses are kept. Your original Journal entries stay as they are.</p>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    <p role="status" className="mt-3 text-xs text-movenotes-text/60">{loading ? "Loading…" : saving ? "Saving…" : ""}</p>
    <FormActions><button type="button" onClick={onClose} disabled={saving}>Done</button></FormActions>
  </CompanionSheet>;
}
