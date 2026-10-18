import { useEffect, useId, useRef, useState } from "react";
import CompanionSheet from "./CompanionSheet";
import FormTextarea from "./forms/FormTextarea";
import { FormActions, FormCancel, FormError } from "./forms/FormLayout";
import {
  FEEDBACK_COMMENT_LIMIT, fetchCompanionFeedback, removeCompanionFeedback, saveCompanionFeedback,
  type CompanionFeedback as Feedback, type CompanionFeedbackRating,
} from "../services/companionFeedback.service";

/** Separate from the journal-response state and persistence on purpose. */
export default function CompanionFeedback({ postId, generatedAt }: { postId: string; generatedAt: string }) {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [ready, setReady] = useState(false);
  const [retry, setRetry] = useState(0);
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<CompanionFeedbackRating>("yes");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const id = useId();

  useEffect(() => {
    let cancelled = false;
    setReady(false); setError(null);
    void fetchCompanionFeedback(postId, generatedAt).then(value => {
      if (!cancelled) { setFeedback(value); setReady(true); }
    }).catch(() => { if (!cancelled) setError("Couldn't load feedback. Please try again."); });
    return () => { cancelled = true; };
  }, [postId, generatedAt, retry]);

  const write = async (nextRating: CompanionFeedbackRating, saveComment = false) => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(null);
    try {
      const value = await saveCompanionFeedback(postId, generatedAt, nextRating, saveComment ? comment : undefined);
      setFeedback(value);
      if (saveComment) setOpen(false);
    } catch { setError("Couldn't save feedback. Please try again. Your journal is unchanged."); }
    finally { pending.current = false; setBusy(false); }
  };
  const chooseRating = (value: CompanionFeedbackRating) => {
    if (pending.current || !ready) return;
    if (!open) setComment(feedback?.comment ?? "");
    setRating(value); setOpen(true);
    void write(value);
  };
  const remove = async () => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(null);
    try {
      await removeCompanionFeedback(postId, generatedAt);
      setFeedback(null); setComment(""); setOpen(false);
    } catch { setError("Couldn't remove feedback. Please try again."); }
    finally { pending.current = false; setBusy(false); }
  };
  const ratings = (inSheet: boolean) => <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Was this useful?">
    {!inSheet && <span className="mr-1">Was this useful?</span>}
    {([['yes', 'Yes'], ['not_really', 'Not really']] as const).map(([value, label]) => <button
      type="button" key={value} disabled={!ready || busy} aria-pressed={(inSheet ? rating : feedback?.rating) === value}
      onClick={() => chooseRating(value)}
      className={`rounded-full border px-3 py-2 disabled:opacity-50 ${inSheet && rating === value ? "border-movenotes-primary bg-warm-200" : "border-current/20 hover:bg-white/40"}`}
    >{label}</button>)}
  </div>;

  return <div className="mt-4 text-xs text-[#506D59]">
    {feedback ? <div className="flex items-center gap-2"><span role="status">Feedback saved</span><span aria-hidden="true">·</span><button type="button" disabled={!ready || busy} className="underline underline-offset-2 py-2" onClick={() => { setRating(feedback.rating); setComment(feedback.comment ?? ""); setError(null); setOpen(true); }}>Edit</button></div> : ratings(false)}
    {!ready && !error && <p role="status" className="mt-2">Loading feedback…</p>}
    {!open && error && <><FormError>{error}</FormError>{!ready && <button type="button" className="underline py-2" onClick={() => setRetry(value => value + 1)}>Retry feedback</button>}</>}
    {open && <CompanionSheet title="Feedback on this thought" busy={busy} dirty={comment !== (feedback?.comment ?? "")} onClose={() => { setOpen(false); setError(null); }}>
      <p className="text-sm mb-3">Was this useful?</p>
      {ratings(true)}
      <label htmlFor={id} className="block text-sm mt-5">Anything you'd like different next time? <span className="text-gray-500">(optional)</span></label>
      <FormTextarea id={id} value={comment} onChange={event => setComment(event.target.value)} maxLength={FEEDBACK_COMMENT_LIMIT} rows={3} disabled={busy} aria-describedby={`${id}-help ${id}-count`} className="mt-2 w-full rounded-xl border border-warm-200 bg-white/70 p-3 text-base" />
      <p id={`${id}-count`} className="mt-1 text-xs text-gray-500">{comment.length}/{FEEDBACK_COMMENT_LIMIT}</p>
      <p id={`${id}-help`} className="mt-3 text-sm text-gray-500">Your feedback helps shape future AI content for you. It stays separate from your journal.</p>
      <FormError>{error}</FormError>
      <div className="mt-4 grid gap-2">
        <FormActions><button type="button" disabled={busy} onClick={() => void write(rating, true)} className="mn-primary w-full">{busy ? "Saving…" : "Save feedback"}</button></FormActions>
        <FormCancel disabled={busy}>Close</FormCancel>
        {feedback && <button type="button" disabled={busy} onClick={() => void remove()} className="text-sm underline py-2">Remove feedback</button>}
      </div>
    </CompanionSheet>}
  </div>;
}
