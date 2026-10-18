import { useCallback, useEffect, useRef, useState } from "react";
import {
  COMPANION_PREFERENCES_CHANGED, ensureWeeklyCompanion, fetchCompanionPosts,
  fetchCompanionPreferences, fetchCompanionAccess, type CompanionPost,
} from "../services/companion.service";

export function useWeeklyCompanion(userId: string | null) {
  const [posts, setPosts] = useState<CompanionPost[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const sequence = useRef(0);
  const load = useCallback(async () => {
    const current = ++sequence.current;
    setMessage(null);
    if (!userId) { setPosts([]); setEnabled(false); setPreparing(false); return; }
    try {
      const allowed = await fetchCompanionAccess();
      if (current !== sequence.current) return;
      if (!allowed) { setEnabled(false); setPosts([]); setPreparing(false); return; }
      const prefs = await fetchCompanionPreferences(userId);
      if (current !== sequence.current) return;
      setEnabled(prefs.enabled);
      if (!prefs.enabled) { setPosts([]); setPreparing(false); return; }
      const existing = await fetchCompanionPosts(userId);
      if (current !== sequence.current) return;
      setPosts(existing); setPreparing(true);
      const result = await ensureWeeklyCompanion();
      if (current !== sequence.current) return;
      if (result.status === "preferences_changed" || result.status === "disabled") {
        setPosts([]); setPreparing(false); return;
      }
      const updated = await fetchCompanionPosts(userId);
      if (current !== sequence.current) return;
      setPosts(updated);
      setMessage(result.message ?? null);
    } catch (error) {
      if (current !== sequence.current) return;
      setMessage(error instanceof Error ? error.message : "Couldn't load your weekly thought just now.");
    } finally {
      if (current === sequence.current) setPreparing(false);
    }
  }, [userId]);

  useEffect(() => {
    setPosts([]); setEnabled(false);
    void load();
    const onPreferences = () => { setPosts([]); void load(); };
    const onStorage = (event: StorageEvent) => { if (event.key === COMPANION_PREFERENCES_CHANGED) onPreferences(); };
    const onVisible = () => { if (document.visibilityState === "visible") void load(); };
    window.addEventListener(COMPANION_PREFERENCES_CHANGED, onPreferences);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      ++sequence.current;
      window.removeEventListener(COMPANION_PREFERENCES_CHANGED, onPreferences);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const updatePost = useCallback((post: CompanionPost) => {
    setPosts((current) => current.map((item) => item.id === post.id ? post : item));
  }, []);
  const removePost = useCallback((postId: string) => {
    setPosts(current => current.filter(post => post.id !== postId));
  }, []);
  return { posts, enabled, preparing, message, retry: load, updatePost, removePost };
}
