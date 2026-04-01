import { SETTINGS_ACTIVITY_TYPE_IDS } from "../config/activityTypes";

export type UserActivityTypeRow = {
  activity_type: string;
  sort_order: number;
  is_enabled: boolean;
};

const SORT_INCREMENT = 10;

const cache = new Map<string, UserActivityTypeRow[]>();
const listeners = new Map<string, Set<(rows: UserActivityTypeRow[]) => void>>();

export const normalizeUserActivityTypes = (rows: UserActivityTypeRow[]) => {
  const rowMap = new Map(rows.map((row) => [row.activity_type, row]));
  return SETTINGS_ACTIVITY_TYPE_IDS.map((activity_type, index) => {
    const existing = rowMap.get(activity_type);
    if (existing) return existing;
    return {
      activity_type,
      sort_order: (index + 1) * SORT_INCREMENT,
      is_enabled: true,
    };
  });
};

export const getCachedUserActivityTypes = (userId: string) =>
  cache.get(userId) ?? null;

export const setCachedUserActivityTypes = (
  userId: string,
  rows: UserActivityTypeRow[]
) => {
  cache.set(userId, rows);
  const subs = listeners.get(userId);
  if (!subs) return;
  subs.forEach((cb) => cb(rows));
};

export const subscribeUserActivityTypes = (
  userId: string,
  cb: (rows: UserActivityTypeRow[]) => void
) => {
  let subs = listeners.get(userId);
  if (!subs) {
    subs = new Set();
    listeners.set(userId, subs);
  }
  subs.add(cb);

  return () => {
    subs?.delete(cb);
    if (subs?.size === 0) {
      listeners.delete(userId);
    }
  };
};

export const clearCachedUserActivityTypes = (userId: string) => {
  cache.delete(userId);
  listeners.delete(userId);
};
