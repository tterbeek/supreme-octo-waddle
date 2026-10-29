export type StravaEvent = {
  object_type: 'activity' | 'athlete'; aspect_type: 'create' | 'update' | 'delete';
  object_id: number; owner_id: number; subscription_id: number; event_time: number;
  updates: Record<string, unknown>;
};

export function parseStravaEvent(value: unknown, subscriptionId: string): StravaEvent | null {
  if (!value || typeof value !== 'object') return null;
  const e = value as StravaEvent;
  if (!['activity', 'athlete'].includes(e.object_type) || !['create', 'update', 'delete'].includes(e.aspect_type)) return null;
  if (![e.object_id, e.owner_id, e.subscription_id, e.event_time].every(n => Number.isSafeInteger(n) && n > 0)) return null;
  if (String(e.subscription_id) !== subscriptionId) return null;
  if (e.updates !== undefined && (!e.updates || typeof e.updates !== 'object' || Array.isArray(e.updates))) return null;
  const updates: Record<string, unknown> = {};
  for (const key of ['private', 'authorized']) {
    const value = e.updates?.[key];
    if (value !== undefined) {
      if (![true, false, 'true', 'false'].includes(value as boolean | string)) return null;
      updates[key] = value;
    }
  }
  return { ...e, updates };
}

export function stravaEventKey(e: StravaEvent) {
  // Stable ordering avoids duplicates when JSON object keys arrive in a different order.
  return JSON.stringify([e.subscription_id,e.owner_id,e.object_type,e.object_id,e.aspect_type,e.event_time,
    Object.entries(e.updates).sort(([a], [b]) => a.localeCompare(b))]);
}
export function stravaEventAction(e: Pick<StravaEvent, 'object_type' | 'aspect_type' | 'updates'>) {
  if (e.object_type === 'athlete') return e.updates.authorized === 'false' || e.updates.authorized === false ? 'disconnect' : 'ignore';
  if (e.aspect_type === 'delete') return 'remove';
  if (e.aspect_type === 'create') return 'import';
  // Do not rewrite title/type or the user's MoveNotes enrichment.
  // Privacy changes are checked against the provider, not treated as title edits.
  return Object.hasOwn(e.updates, 'private') ? 'privacy' : 'ignore';
}
export function secretMatches(actual: string | null, expected: string | undefined) {
  if (!actual || !expected || actual.length !== expected.length) return false;
  let different = 0;
  for (let i = 0; i < actual.length; i++) different |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return different === 0;
}
