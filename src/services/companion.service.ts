import { supabase } from "../supabaseClient";
import type { CompanionPost, CompanionPreferences } from "../../supabase/functions/_shared/companion";
export type { CompanionPost, CompanionPreferences, CompanionSource } from "../../supabase/functions/_shared/companion";

export const COMPANION_PREFERENCES_CHANGED = "movenotes:companion-preferences-changed";
const POST_FIELDS = "id, user_id, week_start, week_end, time_zone, status, thought, sources, includes_activity_notes, user_reflection, created_at, generated_at";

export async function fetchCompanionAccess(): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_companion_access");
  if (error) throw error;
  return data === true;
}

export function defaultCompanionPreferences(): CompanionPreferences {
  return { enabled: false, allow_activity_notes: false, time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" };
}

export async function fetchCompanionPreferences(userId: string): Promise<CompanionPreferences> {
  const { data, error } = await supabase.from("companion_preferences")
    .select("enabled, allow_activity_notes, time_zone").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data ?? defaultCompanionPreferences();
}

export async function saveCompanionPreferences(userId: string, preferences: CompanionPreferences) {
  const { error } = await supabase.from("companion_preferences").upsert({ user_id: userId, ...preferences });
  if (error) throw error;
  window.dispatchEvent(new Event(COMPANION_PREFERENCES_CHANGED));
  try { localStorage.setItem(COMPANION_PREFERENCES_CHANGED, String(Date.now())); } catch { /* Optional cross-tab notification. */ }
}

export async function fetchCompanionPosts(userId: string): Promise<CompanionPost[]> {
  const { data, error } = await supabase.from("companion_posts").select(POST_FIELDS)
    .eq("user_id", userId).in("status", ["ready", "redacted"]).order("created_at", { ascending: false }).limit(1000);
  if (error) throw error;
  return (data ?? []) as unknown as CompanionPost[];
}

export async function ensureWeeklyCompanion(options?: { manual: boolean }): Promise<{ status: string; message?: string }> {
  const { data, error } = await supabase.functions.invoke("weekly-companion", { body: options?.manual ? { manual: true } : {} });
  if (error) {
    const response = error.context as Response | undefined;
    const payload = response instanceof Response ? await response.clone().json().catch(() => null) as { error?: string } | null : null;
    throw new Error(payload?.error || "Couldn't prepare your weekly thought just now.");
  }
  return data;
}

export async function deleteCompanionPost(postId: string, generatedAt: string | null) {
  const { error } = await supabase.rpc("delete_companion_post", { p_post_id: postId, p_generated_at: generatedAt });
  if (error) throw error;
}

export async function saveCompanionResponse(postId: string, text: string): Promise<CompanionPost> {
  const trimmed = text.trim();
  if (trimmed.length > 4000) throw new Error("Please keep your reflection within 4,000 characters.");
  const { data, error } = await supabase.from("companion_posts")
    .update({ user_reflection: trimmed || null }).eq("id", postId).select(POST_FIELDS).single();
  if (error) throw error;
  return data as unknown as CompanionPost;
}
