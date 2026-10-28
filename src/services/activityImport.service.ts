import { supabase } from '../supabaseClient';

export const IMPORT_SYNC_EVENT = 'movenotes:import-sync';
let activeSyncs = 0;
export const importsAreSyncing = () => activeSyncs > 0;
export async function trackImportSync<T>(work: () => Promise<T>): Promise<T> {
  activeSyncs += 1;
  window.dispatchEvent(new Event(IMPORT_SYNC_EVENT));
  try { return await work(); }
  finally {
    activeSyncs -= 1;
    window.dispatchEvent(new Event(IMPORT_SYNC_EVENT));
  }
}

export type ImportingActivity = {
  id: string; external_source: string; import_status: string;
  import_updated_at: string | null; imported_at: string | null; route_polyline: string | null;
};

export async function retryActivityImport(activity: ImportingActivity) {
  if (!['polar', 'strava'].includes(activity.external_source)) throw new Error('Unsupported import source.');
  return trackImportSync(async () => {
    const { error } = await supabase.functions.invoke(`${activity.external_source}-import-activities`, {
      body: { retryActivityId: activity.id },
    });
    if (error) {
      const response = error.context as Response | undefined;
      const body = await response?.clone().json().catch(() => null);
      throw new Error(body?.error || 'Could not retry. Please try again.');
    }
  });
}
