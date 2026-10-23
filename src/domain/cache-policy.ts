export type CacheKind = "player_directory" | "league_meta" | "current_week" | "completed_week";

export const PLAYER_DIRECTORY_TTL_MS = 24 * 60 * 60 * 1000;
export const LEAGUE_META_TTL_MS = 15 * 60 * 1000;
export const CURRENT_WEEK_TTL_MS = 15 * 60 * 1000;

export function shouldFetchUpstream(
  kind: CacheKind,
  fetchedAt: Date | null,
  now: Date,
  correction: boolean,
): boolean {
  if (!fetchedAt) return true;
  const age = now.getTime() - fetchedAt.getTime();
  if (kind === "player_directory") return age >= PLAYER_DIRECTORY_TTL_MS;
  if (kind === "completed_week") return correction;
  if (kind === "league_meta") return age >= LEAGUE_META_TTL_MS;
  return age >= CURRENT_WEEK_TTL_MS;
}
