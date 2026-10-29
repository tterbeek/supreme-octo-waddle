import { beforeEach, describe, expect, it, vi } from 'vitest';
const { polar, strava } = vi.hoisted(() => ({ polar: vi.fn(), strava: vi.fn() }));
vi.mock('./polar.service', () => ({ POLAR_PULL_COOLDOWN_MS: 60_000, syncPolarIfStale: polar }));
vi.mock('./strava.service', () => ({ syncStravaIfStale: strava }));
import { refreshJournalWithImports } from './journalRefresh.service';

describe('Journal pull refresh', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    polar.mockResolvedValue(false);
    strava.mockResolvedValue(false);
  });

  it('checks both providers with a one-minute cooldown and reloads new activities', async () => {
    polar.mockResolvedValue(true);
    strava.mockResolvedValue(true);
    const refresh = vi.fn().mockResolvedValue(undefined);
    await refreshJournalWithImports(refresh);
    expect(polar).toHaveBeenCalledWith(60_000);
    expect(strava).toHaveBeenCalledWith({ staleMinutes: 1 });
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('only reloads once when both providers are disconnected or within cooldown', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    await refreshJournalWithImports(refresh);
    expect(polar).toHaveBeenCalledOnce();
    expect(strava).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it.each(['Polar', 'Strava'])('a failed %s sync does not block the other provider or its results', async provider => {
    const failed = provider === 'Polar' ? polar : strava;
    const successful = provider === 'Polar' ? strava : polar;
    failed.mockRejectedValue(new Error('Connection expired'));
    successful.mockResolvedValue(true);
    const refresh = vi.fn().mockResolvedValue(undefined);
    await expect(refreshJournalWithImports(refresh)).rejects.toThrow(`${provider} sync failed: Connection expired`);
    expect(successful).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('a feed failure does not prevent either provider from being checked', async () => {
    const refresh = vi.fn().mockRejectedValue(new Error('Offline'));
    await expect(refreshJournalWithImports(refresh)).rejects.toThrow('Could not reload the Journal.');
    expect(polar).toHaveBeenCalledOnce();
    expect(strava).toHaveBeenCalledOnce();
  });
});
