import { describe, expect, it } from 'vitest';
import { buildTrendSeries } from './activityTrends';

describe('trend series', () => {
  it('keeps metrics separate, sorts calendar buckets and preserves logged zeroes', () => {
    expect(buildTrendSeries([
      { activity_type: 'run', period_start: '2026-10-01', distance_value: 0, duration_value: 30 },
      { activity_type: 'walk', period_start: '2026-09-01', distance_value: null, duration_value: 10 },
      { activity_type: 'run', period_start: '2026-08-01', distance_value: 12, duration_value: null },
    ])).toEqual({
      'run:distance': [{ period_start: '2026-08-01', value: 12 }, { period_start: '2026-10-01', value: 0 }],
      'run:duration': [{ period_start: '2026-10-01', value: 30 }],
      'walk:duration': [{ period_start: '2026-09-01', value: 10 }],
    });
  });
  it('returns no series for an empty range', () => expect(buildTrendSeries([])).toEqual({}));
});
