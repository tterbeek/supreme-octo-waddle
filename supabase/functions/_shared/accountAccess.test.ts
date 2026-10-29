import { describe, expect, it } from 'vitest';
import { isOwnerAccount, OWNER_USER_IDS } from './accountAccess';
import { canRunWeeklyNow } from './companion';

describe('owner account IDs', () => {
  it('keeps production and dev access after changing their login emails', () => {
    for (const id of Object.values(OWNER_USER_IDS)) {
      const owner = { id, email: 'changed@example.test', email_confirmed_at: '2026-10-29' };
      expect(isOwnerAccount(owner)).toBe(true);
      expect(canRunWeeklyNow(owner)).toBe(true);
    }
  });
  it('does not grant access to a new holder of the old email or editable metadata', () => {
    const outsider = { id: 'other-user', email: 'me@thijsterbeek.com', email_confirmed_at: '2026-10-29', user_metadata: { id: OWNER_USER_IDS.production, admin: true } };
    expect(isOwnerAccount(outsider)).toBe(false);
    expect(canRunWeeklyNow(outsider)).toBe(false);
    expect(isOwnerAccount({})).toBe(false);
  });
});
