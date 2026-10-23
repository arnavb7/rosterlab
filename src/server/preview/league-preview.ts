import { detectLeagueFormat, formatSummary } from "@/domain/league-format";
import { createDemoClient } from "@/fixtures/demo/client";
import { isDemoLeagueId } from "@/lib/validators";
import { getSleeperHttpClient, type SleeperClient } from "@/server/providers/sleeper/client";
import type { SleeperLeague, SleeperLeagueUser, SleeperRoster } from "@/server/providers/sleeper/schemas";

const LEAGUE_TTL_MS = 15 * 60 * 1000;

export type LeaguePreview = {
  leagueId: string;
  name: string;
  season: string;
  status: string;
  sport: string;
  demo: boolean;
  formatLines: string[];
  disabledAnalyses: string[];
  fromCache: boolean;
  fetchedAt: string;
  rosters: {
    rosterId: number;
    ownerName: string;
    teamName: string | null;
    playerCount: number;
    record: string | null;
  }[];
};

export type UserLookup = {
  userId: string;
  username: string | null;
  displayName: string | null;
  season: string;
  seasonsOffered: string[];
  leagues: { leagueId: string; name: string; season: string; status: string; totalRosters: number | null }[];
  fromCache: boolean;
};

const leagueCache = new Map<string, { at: number; preview: LeaguePreview }>();
const userCache = new Map<string, { at: number; lookup: UserLookup }>();
let stateCache: { at: number; leagueSeason: string; previousSeason: string } | null = null;

function clientFor(leagueId: string): SleeperClient {
  return isDemoLeagueId(leagueId) ? createDemoClient() : getSleeperHttpClient();
}

function recordLabel(settings: Record<string, unknown> | null | undefined): string | null {
  if (!settings || typeof settings.wins !== "number" || typeof settings.losses !== "number") return null;
  return `${settings.wins}-${settings.losses}`;
}

function buildPreview(
  league: SleeperLeague,
  users: SleeperLeagueUser[],
  rosters: SleeperRoster[],
  fetchedAt: string,
): LeaguePreview {
  const format = detectLeagueFormat({
    sport: league.sport,
    settings: league.settings ?? {},
    rosterPositions: league.roster_positions ?? [],
    scoringSettings: league.scoring_settings ?? {},
    draftTypes: [],
  });
  return {
    leagueId: league.league_id,
    name: league.name,
    season: league.season,
    status: league.status,
    sport: league.sport,
    demo: isDemoLeagueId(league.league_id),
    formatLines: formatSummary(format),
    disabledAnalyses: format.disabledAnalyses,
    fromCache: false,
    fetchedAt,
    rosters: [...rosters]
      .sort((left, right) => left.roster_id - right.roster_id)
      .map((roster) => {
        const user = users.find((item) => item.user_id === roster.owner_id);
        const teamName = user?.metadata?.team_name;
        return {
          rosterId: roster.roster_id,
          ownerName: roster.owner_id ? user?.display_name || roster.owner_id : "No owner recorded",
          teamName: typeof teamName === "string" ? teamName : null,
          playerCount: (roster.players ?? []).filter((id) => typeof id === "string" && id !== "").length,
          record: recordLabel(roster.settings),
        };
      }),
  };
}

export async function loadLeaguePreview(leagueId: string, now = Date.now()): Promise<LeaguePreview | null> {
  const cached = leagueCache.get(leagueId);
  if (cached && now - cached.at < LEAGUE_TTL_MS) {
    return { ...cached.preview, fromCache: true };
  }
  const client = clientFor(leagueId);
  const league = await client.getLeague(leagueId);
  if (!league) return null;
  const [users, rosters] = await Promise.all([client.getLeagueUsers(leagueId), client.getRosters(leagueId)]);
  const preview = buildPreview(league, users, rosters, new Date(now).toISOString());
  leagueCache.set(leagueId, { at: now, preview });
  return preview;
}

export async function loadNflSeasons(now = Date.now()): Promise<{ leagueSeason: string; previousSeason: string }> {
  if (stateCache && now - stateCache.at < LEAGUE_TTL_MS) {
    return { leagueSeason: stateCache.leagueSeason, previousSeason: stateCache.previousSeason };
  }
  const state = await getSleeperHttpClient().getNflState();
  const seasons = {
    leagueSeason: state.league_season || state.season,
    previousSeason: state.previous_season || state.season,
  };
  stateCache = { at: now, ...seasons };
  return seasons;
}

export async function loadUserLeagues(username: string, season: string, now = Date.now()): Promise<UserLookup | null> {
  const key = `${username}:${season}`;
  const cached = userCache.get(key);
  if (cached && now - cached.at < LEAGUE_TTL_MS) return { ...cached.lookup, fromCache: true };
  const client = getSleeperHttpClient();
  const user = await client.getUser(username);
  if (!user) return null;
  const seasons = await loadNflSeasons(now);
  const leagues = await client.getUserLeagues(user.user_id, season);
  const lookup: UserLookup = {
    userId: user.user_id,
    username: user.username ?? null,
    displayName: user.display_name ?? null,
    season,
    seasonsOffered: [...new Set([seasons.leagueSeason, seasons.previousSeason, season])],
    leagues: leagues.map((league) => ({
      leagueId: league.league_id,
      name: league.name,
      season: league.season,
      status: league.status,
      totalRosters: league.total_rosters ?? null,
    })),
    fromCache: false,
  };
  userCache.set(key, { at: now, lookup });
  return lookup;
}
