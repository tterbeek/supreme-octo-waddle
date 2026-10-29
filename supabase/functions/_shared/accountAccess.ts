// Known owner identities, not mutable email addresses or profile metadata.
export const OWNER_USER_IDS = {
  production: '589c83df-8ee7-4319-9203-5b5c9aae0d07',
  development: '7725b4a2-16df-47dd-bae0-c7695717a342',
} as const;

export function isOwnerAccount(user: { id?: string | null }) {
  return user.id === OWNER_USER_IDS.production || user.id === OWNER_USER_IDS.development;
}
