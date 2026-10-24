export type MemoryContext = { start?: string; end?: string; ids?: string[]; photoId?: string; selection?: 'selected' | 'all'; includeId?: string };
export function monthRange(month: string) {
  const [year, number] = month.split('-').map(Number);
  return { start: `${month}-01`, end: `${year + (number === 12 ? 1 : 0)}-${String(number === 12 ? 1 : number + 1).padStart(2, '0')}-01` };
}
export function dayRange(day: string) {
  const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + 1);
  return { start: day, end: date.toISOString().slice(0, 10) };
}
export function memoryTitle(activity: { title?: string | null; type: string }, label: string) {
  return activity.title?.trim() || label;
}
export const featureLabels = ['On this day', 'Around this time', 'A moment to revisit'];
export function distinctMemoryIds(ids: string[]) { return [...new Set(ids)]; }
export function collectionNeighbors(ids: string[], id: string) {
  const ordered = distinctMemoryIds(ids); const index = ordered.indexOf(id);
  return { later: index > 0 ? ordered[index - 1] : null, earlier: index >= 0 ? ordered[index + 1] ?? null : null, position: index + 1, total: ordered.length };
}
