import { POLAR_PULL_COOLDOWN_MS, syncPolarIfStale } from './polar.service';
import { syncStravaIfStale } from './strava.service';

/** Each provider checks its own connection and cooldown; failures stay independent. */
export async function refreshJournalWithImports(refreshFeed: () => Promise<void>) {
  const [feed, polar, strava] = await Promise.allSettled([
    refreshFeed(),
    syncPolarIfStale(POLAR_PULL_COOLDOWN_MS),
    syncStravaIfStale({ staleMinutes: 1 }),
  ]);
  // Show successful imports even if the other provider failed.
  if ([polar, strava].some(result => result.status === 'fulfilled' && result.value)) {
    await refreshFeed();
  }
  const errors: string[] = [];
  if (feed.status === 'rejected') errors.push('Could not reload the Journal.');
  for (const [provider, result] of [['Polar', polar], ['Strava', strava]] as const) {
    if (result.status === 'rejected') {
      const detail = result.reason instanceof Error ? result.reason.message : 'Please try again.';
      errors.push(`${provider} sync failed: ${detail}`);
    }
  }
  if (errors.length) throw new Error(errors.join(' '));
}
