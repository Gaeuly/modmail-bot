export function formatUserIdentity(
  userId: string,
  username: string,
  nickname?: string | null
): string {
  let identity = `${username} (ID: ${userId})`;

  if (nickname) {
    identity = `${nickname} ~ ${identity}`;
  }

  return identity;
}
