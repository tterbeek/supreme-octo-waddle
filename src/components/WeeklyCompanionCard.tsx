import FormTextarea from "./forms/FormTextarea";
import { useEffect, useRef, useState } from "react";
import { IconDotsVertical, IconInfoCircle, IconTrash } from "@tabler/icons-react";
import CompanionSheet from "./CompanionSheet";
import { FormActions, FormCancel } from "./forms/FormLayout";
import { deleteCompanionPost, saveCompanionResponse, type CompanionPost } from "../services/companion.service";
import CompanionFeedback from "./CompanionFeedback";

export default function WeeklyCompanionCard({ post, onSaved, onDeleted }: { post: CompanionPost; onSaved: (post: CompanionPost) => void; onDeleted?: () => void }) {
  const [sheet, setSheet] = useState<"sources" | "response" | "delete" | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [removed, setRemoved] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const deletePending = useRef(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!actionsOpen) return;
    const outside = (event: PointerEvent) => { if (!actionsRef.current?.contains(event.target as Node)) setActionsOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [actionsOpen]);
  const remove = async () => {
    if (deletePending.current) return;
    deletePending.current = true; setSaving(true); setError(null);
    try { await deleteCompanionPost(post.id, post.generated_at); setSheet(null); setRemoved(true); onDeleted?.(); }
    catch { setError("Couldn't delete your weekly thought. Please try again."); }
    finally { deletePending.current = false; setSaving(false); }
  };
  const formatDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const save = async (value: string) => {
    if (saving) return;
    setSaving(true); setError(null);
    try { onSaved(await saveCompanionResponse(post.id, value)); setSheet(null); }
    catch { setError("Couldn't save your reflection. Please try again."); }
    finally { setSaving(false); }
  };
  if (removed) return null;
  return <>
    <article aria-label="Weekly Companion thought" className="relative w-full rounded-xl border border-[#B9C9BA] border-l-4 border-l-[#5A7A69] bg-[#EAF0E9] p-5 sm:p-6 text-[#273C30]">
      <div ref={actionsRef} className="absolute right-1 top-1" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setActionsOpen(false); }} onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); setActionsOpen(false); actionsRef.current?.querySelector("button")?.focus(); } }}>
        <button type="button" aria-label="Weekly thought actions" aria-expanded={actionsOpen} onClick={() => setActionsOpen(value => !value)} className="p-3 rounded-full text-gray-500 hover:bg-white/50"><IconDotsVertical size={18} /></button>
        {actionsOpen && <div className="absolute right-0 top-full z-10 w-44 rounded-xl border border-warm-200 bg-warm-100 p-1 shadow-lg text-movenotes-text">
          <button type="button" className="w-full flex items-center gap-2 text-left px-3 py-3 text-sm rounded-lg hover:bg-white/60" onClick={() => { actionsRef.current?.querySelector("button")?.focus(); setActionsOpen(false); setError(null); setSheet("delete"); }}><IconTrash size={16} strokeWidth={1.9} aria-hidden="true" />Delete</button>
        </div>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1 pr-6">
        <span className="text-[11px] font-semibold tracking-[0.14em] uppercase">Companion · Weekly reflection</span>
        {post.status === "ready" && <button type="button" onClick={() => setSheet("sources")} aria-label="AI reflection: what it used" className="inline-flex items-center gap-1 text-[11px] rounded-full border border-[#AEBBB0] px-2 py-1 text-[#506D59] hover:bg-white/40"><IconInfoCircle size={13} /> AI reflection</button>}
      </div>
      <p className="text-xs text-[#66786A] mb-3">{formatDate(post.week_start)}–{formatDate(post.week_end)}</p>
      <h3 className="font-playfair italic text-xl mb-3">A thought for the week</h3>
      {post.status === "ready" ? <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{post.thought}</p> : <p className="text-sm text-movenotes-text/65">This thought was removed when you turned off activity-note use.</p>}
      {post.status === "ready" && post.generated_at && <CompanionFeedback key={`${post.id}:${post.generated_at}`} postId={post.id} generatedAt={post.generated_at} />}
      <div className="mt-4 pt-3 border-t border-[#CBD8CA] flex flex-wrap items-center gap-4 text-sm">
        <button type="button" className="underline underline-offset-2" onClick={() => { setDraft(post.user_reflection ?? ""); setError(null); setSheet("response"); }}>{post.user_reflection ? "Edit your reflection" : "Add your reflection"}</button>
        {post.status === "ready" && <button type="button" className="text-[#66786A] underline underline-offset-2" onClick={() => setSheet("sources")}>What it used</button>}
      </div>
      {post.user_reflection && <div className="mt-4 rounded-xl border border-[#D9DFD5] bg-[#FAF8F3] p-3 text-movenotes-text">
        <span className="text-xs text-movenotes-text/60">Your reflection · written by you</span>
        <p className="mt-1 text-sm whitespace-pre-wrap break-words">{post.user_reflection}</p>
      </div>}
    </article>
    {sheet === "delete" && <CompanionSheet title="Delete weekly thought?" presentation="dialog" busy={saving} onClose={() => setSheet(null)}>
      <p>This removes this thought, your reflection on it, and its feedback. It won't return on refresh. The next week's thought is unaffected; Run weekly now in Admin can explicitly create this week's thought again.</p>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <FormCancel disabled={saving}>Cancel</FormCancel>
      <FormActions><button type="button" disabled={saving} onClick={() => void remove()} className="mn-primary w-full">{saving ? "Deleting…" : "Delete weekly thought"}</button></FormActions>
    </CompanionSheet>}
    {sheet === "sources" && <CompanionSheet title="What it used" onClose={() => setSheet(null)}>
      <p className="text-sm text-movenotes-text/70 mb-4">AI composed the thought and question. The records below are the context used when it was written. Totals are calculated; quoted reflections and notes are your words.</p>
      <div className="space-y-2">{post.sources.map((source, index) => <div key={`${source.kind}-${index}`} className="rounded-xl border border-warm-200 p-3">
        <h3 className="text-sm font-semibold">{source.label}</h3>
        <p className="mt-1 text-sm text-movenotes-text/70 whitespace-pre-wrap break-words">{source.detail}</p>
      </div>)}</div>
      <p className="mt-4 text-xs text-movenotes-text/60">{post.includes_activity_notes ? "Activity-note use was enabled for this thought." : "Private activity notes were not used."}</p>
    </CompanionSheet>}
    {sheet === "response" && <CompanionSheet title="Your reflection" busy={saving} dirty={draft !== (post.user_reflection ?? "")} onClose={() => setSheet(null)}>
      <p className="text-sm text-movenotes-text/70 mb-4">What felt true, different, or missing? You can also leave this thought unanswered.</p>
      <label htmlFor="companion-response" className="block text-sm">Your words</label>
      <FormTextarea id="companion-response" value={draft} onChange={(event) => setDraft(event.target.value)} rows={6} maxLength={4000} disabled={saving} className="mt-2 w-full rounded-xl border border-warm-200 bg-white/70 p-3 text-base" />
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <div className="mt-4 grid gap-2">
        <FormActions><button type="button" disabled={saving || !draft.trim()} onClick={() => void save(draft)} className="rounded-full bg-movenotes-primary text-white px-4 py-3 disabled:opacity-50">{saving ? "Saving…" : "Save my reflection"}</button></FormActions>
        <FormCancel disabled={saving}>Not now</FormCancel>
        {post.user_reflection && <button type="button" disabled={saving} onClick={() => void save("")} className="text-sm underline py-2">Remove my reflection</button>}
      </div>
    </CompanionSheet>}
  </>;
}
