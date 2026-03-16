import { supabase } from "../supabaseClient";
import { getCurrentUser } from "./auth.service";

export type JournalEntryRow = {
  id: string;
  user_id: string;
  entry_type: string;
  text: string;
  created_at: string;
  related_activity_id?: string | null;
  related_tiny_tweak_id?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function createJournalEntry(text: string) {
  const user = await getCurrentUser();
  if (!user) {
    return {
      data: null,
      error: { message: "No authenticated user." },
    };
  }

  const payload = {
    user_id: user.id,
    entry_type: "journal_note",
    text: text.trim(),
  };

  const { data, error } = await supabase
    .from("journal_entries")
    .insert(payload)
    .select("id, user_id, entry_type, text, created_at, related_activity_id, related_tiny_tweak_id, metadata")
    .single();

  return { data: data as JournalEntryRow | null, error };
}

export async function updateJournalEntryText(entryId: string, text: string) {
  const { data, error } = await supabase
    .from("journal_entries")
    .update({ text: text.trim() })
    .eq("id", entryId)
    .select("id, user_id, entry_type, text, created_at, related_activity_id, related_tiny_tweak_id, metadata")
    .single();

  return { data: data as JournalEntryRow | null, error };
}

export async function deleteJournalEntry(entryId: string) {
  const { error } = await supabase.from("journal_entries").delete().eq("id", entryId);
  return { error };
}

export async function fetchJournalEntriesInRange(
  userId: string,
  startIso: string,
  endIso: string
) {
  const { data, error } = await supabase
    .from("journal_entries")
    .select("id, user_id, entry_type, text, created_at, related_activity_id, related_tiny_tweak_id, metadata")
    .eq("user_id", userId)
    .gte("created_at", startIso)
    .lt("created_at", endIso)
    .order("created_at", { ascending: false });

  return { data: (data || []) as JournalEntryRow[], error };
}
