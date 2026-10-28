import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const { invoke, session } = vi.hoisted(() => ({ invoke: vi.fn(), session: vi.fn() }));
vi.mock('../supabaseClient', () => ({ supabase: { functions: { invoke }, auth: { getSession: session } } }));
vi.mock('./activityImport.service', () => ({ trackImportSync: (work: () => Promise<unknown>) => work() }));
let polar: typeof import('./polar.service');
const now = new Date('2026-10-28T12:00:00Z');
let lastSync: string | null;
const imports = () => invoke.mock.calls.filter(([name]) => name === 'polar-import-activities').length;

beforeEach(async () => {
  vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(now);
  invoke.mockReset(); session.mockReset();
  session.mockResolvedValue({ data: { session: { user: { id: 'owner' } } } });
  lastSync = '2026-10-28T11:58:00Z';
  invoke.mockImplementation(async name => ({ data: name === 'polar-connection'
    ? { connected: true, last_synced_at: lastSync }
    : { ok: true, fetched: 0, inserted: 0, skipped: 0 }, error: null }));
  polar = await import('./polar.service');
});
afterEach(() => { vi.useRealTimers(); });

describe('Polar pull-to-refresh cooldown', () => {
  it('keeps the automatic 30-minute window, but permits a manual check after one minute', async () => {
    expect(await polar.syncPolarIfStale()).toBe(false);
    expect(imports()).toBe(0);
    expect(await polar.syncPolarIfStale(polar.POLAR_PULL_COOLDOWN_MS)).toBe(true);
    expect(imports()).toBe(1);
    expect(await polar.syncPolarIfStale(polar.POLAR_PULL_COOLDOWN_MS)).toBe(false);
    vi.advanceTimersByTime(60_000);
    expect(await polar.syncPolarIfStale(polar.POLAR_PULL_COOLDOWN_MS)).toBe(true);
    expect(imports()).toBe(2);
  });
  it('uses the server timestamp after a fresh page load and skips disconnected users', async () => {
    lastSync = '2026-10-28T11:59:30Z';
    expect(await polar.syncPolarIfStale(60_000)).toBe(false);
    invoke.mockResolvedValue({ data: { connected: false }, error: null });
    expect(await polar.syncPolarIfStale(60_000)).toBe(false);
    expect(imports()).toBe(0);
  });
  it('shares concurrent pulls and a direct/manual import instead of overlapping requests', async () => {
    let finish!: (result: unknown) => void;
    const waiting = new Promise(resolve => { finish = resolve; });
    invoke.mockImplementation(name => name === 'polar-import-activities' ? waiting : Promise.resolve({ data: { connected: true, last_synced_at: null }, error: null }));
    const first = polar.importPolarActivities();
    await vi.waitFor(() => expect(imports()).toBe(1));
    const second = polar.syncPolarIfStale(60_000);
    const third = polar.importPolarActivities();
    finish({ data: { ok: true, inserted: 0 }, error: null });
    await Promise.all([first, second, third]);
    expect(imports()).toBe(1);
  });
  it('does not lose a manual pull behind an automatic check that skipped syncing', async () => {
    expect(await Promise.all([polar.syncPolarIfStale(), polar.syncPolarIfStale(60_000)])).toEqual([false, true]);
    expect(imports()).toBe(1);
  });
  it('limits failed attempts too, and backs off for a provider 429', async () => {
    invoke.mockImplementation(async name => name === 'polar-connection'
      ? { data: { connected: true, last_synced_at: null }, error: null }
      : { data: null, error: { message: 'Polar API request failed (429).' } });
    await expect(polar.syncPolarIfStale(60_000)).rejects.toThrow('429');
    vi.advanceTimersByTime(60_000);
    await expect(polar.syncPolarIfStale(60_000)).rejects.toThrow('limiting requests');
    expect(imports()).toBe(1);
    vi.advanceTimersByTime(14 * 60_000);
    await expect(polar.syncPolarIfStale(60_000)).rejects.toThrow('429');
    expect(imports()).toBe(2);
  });
  it('scopes cooldowns to the signed-in user', async () => {
    expect(await polar.syncPolarIfStale(60_000)).toBe(true);
    session.mockResolvedValue({ data: { session: { user: { id: 'another-owner' } } } });
    expect(await polar.syncPolarIfStale(60_000)).toBe(true);
    session.mockResolvedValue({ data: { session: null } });
    expect(await polar.syncPolarIfStale(60_000)).toBe(false);
    expect(imports()).toBe(2);
  });
});
