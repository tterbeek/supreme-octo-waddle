import { supabase } from '../supabaseClient';
import type { Json } from '../database.types';
import type { ActivityPhoto } from '../lib/photos';
import { collectionNeighbors, type MemoryContext } from '../lib/memories';

export type MemoryActivity = {
  id: string; user_id?: string; date: string; created_at: string | null; title: string | null; type: string;
  notes: string | null; photos: ActivityPhoto[]; note_image_url: string | null; note_thumb_image_url: string | null;
  distance_km?: number | null; duration_min?: number | null; feeling?: number | null;
  feeling_during?: string | null; feeling_after?: string | null; effort?: number | null;
};
export type ArchiveMonth = { month: string; count: number; thumbs: string[] };
export type MemoryNeighbors = { earlier?: string | null; later?: string | null; position?: number; total?: number };
export async function memoryOwner() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Please sign in.');
  return data.user.id;
}
export async function loadMemory(id: string): Promise<MemoryActivity | null> {
  const uid = await memoryOwner();
  const { data, error } = await supabase.from('activities').select('*,photos:activity_photos(id,image_path,thumb_path,sort_order,created_at)')
    .eq('user_id', uid).eq('id', id).maybeSingle();
  if (error) throw error;
  return data as MemoryActivity | null;
}
export async function memoryArchive() {
  const { data, error } = await supabase.rpc('memory_archive', {}); if (error) throw error;
  return data as unknown as ArchiveMonth[];
}
export async function memoryPage(start: string, end: string, before?: MemoryActivity) {
  const { data, error } = await supabase.rpc('memory_page', { p_start: start, p_end: end,
    ...(before ? { p_before: { id: before.id, date: before.date, created_at: before.created_at } as Json } : {}) });
  if (error) throw error; return data as unknown as MemoryActivity[];
}
export async function memoryNeighbors(id: string, context: MemoryContext): Promise<MemoryNeighbors> {
  if (context.ids) return collectionNeighbors(context.ids, id);
  if (!context.start || !context.end) return {};
  const { data, error } = await supabase.rpc('memory_neighbors', { p_id: id, p_start: context.start, p_end: context.end });
  if (error) throw error; return data as MemoryNeighbors;
}
export async function memoryFeature() {
  const { data, error } = await supabase.rpc('memory_feature', { p_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' });
  if (error) throw error; return data as { day: string; id?: string | null; tier?: number };
}
export async function memoryFeatureAction(day: string, id: string, hide = false) {
  const { error } = await supabase.rpc('memory_feature_action', { p_day: day, p_id: id, p_hide: hide });
  if (error) throw error;
}
