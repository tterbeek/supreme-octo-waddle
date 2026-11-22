import { describe, it, expect } from 'vitest';
import { ACTIVITY_TYPES, isCreatableActivityType, supportsEffort, supportsActivityField } from './activityTypes';
import { normalizeUserActivityTypes } from '../lib/userActivityTypesCache';

describe('Dance activity', () => {
  it('is available to existing users without resetting their preferences', () => {
    const rows = normalizeUserActivityTypes([{ activity_type: 'run', sort_order: 70, is_enabled: false }]);
    expect(rows.find(row => row.activity_type === 'run')).toEqual({ activity_type: 'run', sort_order: 70, is_enabled: false });
    expect(rows.find(row => row.activity_type === 'dance')?.is_enabled).toBe(true);
    expect(isCreatableActivityType('dance')).toBe(true);
  });
  it('uses duration and supports optional effort through the shared forms', () => {
    expect(ACTIVITY_TYPES.dance.defaultFields).toEqual(['duration_min']);
    expect(supportsEffort('dance')).toBe(true);
    expect(supportsActivityField('dance','distance_km')).toBe(false);
  });
});
