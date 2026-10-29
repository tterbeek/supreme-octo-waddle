import { describe, expect, it } from 'vitest';
import { parseStravaEvent, secretMatches, stravaEventAction, stravaEventKey } from './stravaWebhook';

const event = { owner_id: 123,object_id: 456,subscription_id: 789,event_time: 1793260800,
  object_type: 'activity' as const,aspect_type: 'create' as const,updates: {} };
describe('Strava webhook input boundary', () => {
  it('requires the configured subscription and safe identifiers', () => {
    expect(parseStravaEvent(event, '789')).toEqual(event);
    expect(parseStravaEvent(event, 'other')).toBeNull();
    for (const value of [null, {}, { ...event, owner_id: -1 }, { ...event, object_id: '456' },
      { ...event, object_type: 'unknown' }, { ...event, event_time: Infinity }, { ...event, updates: [] }]) {
      expect(parseStravaEvent(value, '789')).toBeNull();
    }
  });
  it('discards unused provider text instead of storing titles in the queue', () => {
    expect(parseStravaEvent({ ...event, updates: { title: 'Private title', type: 'Run', private: 'true' } }, '789')?.updates)
      .toEqual({ private: 'true' });
  });
  it('deduplicates redeliveries including reordered update fields', () => {
    const first = { ...event, updates: { private: 'true', authorized: 'false' } };
    const second = { ...event, updates: { authorized: 'false', private: 'true' } };
    expect(stravaEventKey(first)).toBe(stravaEventKey(second));
    expect(stravaEventKey(first)).not.toBe(stravaEventKey({ ...first, event_time: first.event_time + 1 }));
  });
  it('imports creates, ignores ordinary edits, and handles withdrawal separately', () => {
    expect(stravaEventAction(event)).toBe('import');
    expect(stravaEventAction({ ...event, aspect_type: 'update', updates: { title: 'New title', type: 'Ride' } })).toBe('ignore');
    expect(stravaEventAction({ ...event, aspect_type: 'delete' })).toBe('remove');
    expect(stravaEventAction({ ...event, aspect_type: 'update', updates: { private: true } })).toBe('privacy');
    expect(stravaEventAction({ ...event, object_type: 'athlete', aspect_type: 'update', updates: { authorized: 'false' } })).toBe('disconnect');
  });
  it('never accepts an unset or incorrect endpoint secret', () => {
    expect(secretMatches(null, undefined)).toBe(false);
    expect(secretMatches('abc', undefined)).toBe(false);
    expect(secretMatches('abc', 'abd')).toBe(false);
    expect(secretMatches('abc', 'abc')).toBe(true);
  });
});
