import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type ImportAttempt = { id: string; user_id: string; import_token: string };

/** A lease prevents retries/concurrent syncs from finishing an older attempt. */
export async function finishActivityImport(
  client: SupabaseClient, attempt: ImportAttempt, prepare: () => Promise<Record<string, unknown>>,
) {
  try {
    const values = await prepare();
    const { error } = await client.from('activities').update({ ...values, import_status: 'ready', import_updated_at: new Date().toISOString() })
      .eq('id', attempt.id).eq('user_id', attempt.user_id).eq('import_token', attempt.import_token).eq('import_status', 'processing');
    if (error) throw error;
  } catch {
    console.warn('[activity-import] Preparation failed; owner can retry.');
    const { error } = await client.from('activities').update({ import_status: 'failed', import_updated_at: new Date().toISOString() })
      .eq('id', attempt.id).eq('user_id', attempt.user_id).eq('import_token', attempt.import_token).eq('import_status', 'processing');
    if (error) console.warn('[activity-import] Could not persist failure; stale import remains retryable.');
  }
}

export function importCanRetry(status: string, updatedAt: string | null, now = Date.now()) {
  return status === 'failed' || (status === 'processing' && (!updatedAt || now - Date.parse(updatedAt) > 120_000));
}
