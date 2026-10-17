import { useRef, useState } from "react";
import DialogSheet from "./DialogSheet";
import { FormActions, FormError } from "./forms/FormLayout";
import { supabase } from "../supabaseClient";
import { deleteActivityImages } from "../services/activityMedia.service";

export default function DeleteActivityDialog({ activityId, onClose, onDeleted }: {
  activityId: string; onClose: () => void; onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const remove = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true); setError(null);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Sign in to delete your activity.");
      const userId = auth.user.id;
      const { data: activity, error: activityError } = await supabase.from("activities")
        .select("note_image_url, note_thumb_image_url").eq("id", activityId).eq("user_id", userId).single();
      if (activityError || !activity) throw new Error("Couldn't load your activity. Try again.");
      const { data: photos, error: photoError } = await supabase.from("activity_photos")
        .select("image_path, thumb_path").eq("activity_id", activityId).eq("user_id", userId);
      if (photoError) throw photoError;
      const paths = [...new Set([activity.note_image_url, activity.note_thumb_image_url,
        ...(photos || []).flatMap(photo => [photo.image_path, photo.thumb_path])].filter((path): path is string => Boolean(path)))];
      // Delete the record first: a failed delete must never destroy its photos.
      // Photo metadata and Circle shares cascade with the activity.
      const { data: deleted, error: deleteError } = await supabase.from("activities").delete()
        .eq("id", activityId).eq("user_id", userId).select("id");
      if (deleteError || !deleted?.length) throw new Error("Couldn't delete your activity. Try again.");
      try { await deleteActivityImages(paths); }
      catch { console.warn("Activity deleted; photo storage cleanup could not finish."); }
      onClose(); onDeleted();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't delete your activity. Try again.");
    } finally { pending.current = false; setBusy(false); }
  };
  return <DialogSheet title="Delete activity?" presentation="dialog" onClose={onClose} busy={busy}>
    <p>This permanently deletes the activity, its notes and photos, and removes it from your Circle. This cannot be undone.</p>
    <FormError>{error}</FormError>
    <button type="button" className="mn-form-cancel mt-4" disabled={busy} onClick={onClose}>Cancel</button>
    <FormActions><button type="button" className="mn-primary w-full" disabled={busy} onClick={() => void remove()}>{busy ? "Deleting…" : "Delete activity"}</button></FormActions>
  </DialogSheet>;
}
