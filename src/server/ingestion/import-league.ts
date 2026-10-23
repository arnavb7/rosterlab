import { shouldFetchUpstream, type CacheKind } from "@/domain/cache-policy";
import { normalizeDraftPicks } from "@/domain/draft-picks";
import { selectNextHistoryLeague } from "@/domain/history";
import {
  initialCursor,
  type DataCompleteness,
  type ImportCursor,
  type LeagueContext,
  type NormalizedLeague,
  type NormalizedMatchup,
  type NormalizedMembership,
  type NormalizedRoster,
} from "@/domain/normalized";
import { normalizeTransaction } from "@/domain/transactions";
import { planWeeks } from "@/domain/weeks";
import type { FilePlayerDirectory } from "@/server/players/directory";
import { isRetryableProviderError, ProviderError } from "@/server/providers/errors";
import type { SleeperClient } from "@/server/providers/sleeper/client";
import type {
  SleeperDraft,
  SleeperLeague,
  SleeperLeagueUser,
  SleeperMatchup,
  SleeperRoster,
} from "@/server/providers/sleeper/schemas";
import type { ImportStore } from "@/server/ingestion/store";

export type ImportRunOptions = {
  rootLeagueId: string;
  isDemo: boolean;
  correction: boolean;
  historyLimit: number;
  now: Date;
  client: SleeperClient;
  store: ImportStore;
  directory: FilePlayerDirectory;
  cursor?: ImportCursor;
  onProgress?: (cursor: ImportCursor) => Promise<void>;
};

export type ImportRunResult = {
  cursor: ImportCursor;
  status: "succeeded" | "partial";
};

function ids(values: (string | null)[] | null | undefined): string[] {
  return (values ?? []).filter((value): value is string => typeof value === "string" && value.length > 0);
}

function normalizeLeague(league: SleeperLeague, isDemo: boolean): NormalizedLeague {
  return {
    externalLeagueId: league.league_id,
    sport: league.sport,
    season: league.season,
    name: league.name,
    status: league.status,
    seasonType: league.season_type ?? null,
    previousLeagueId: league.previous_league_id ?? null,
    primaryDraftId: league.draft_id ?? null,
    avatar: league.avatar ?? null,
    totalRosters: league.total_rosters ?? null,
    rosterPositions: league.roster_positions ?? [],
    scoringSettings: league.scoring_settings ?? {},
    settings: league.settings ?? {},
    leagueMetadata: league.metadata ?? null,
    isDemo,
  };
}

function leagueContext(league: NormalizedLeague): LeagueContext {
  return {
    previousLeagueId: league.previousLeagueId,
    status: league.status,
    season: league.season,
    sport: league.sport,
    settings: league.settings,
    scoringSettings: league.scoringSettings,
    rosterPositions: league.rosterPositions,
  };
}

function normalizeUser(user: SleeperLeagueUser): NormalizedMembership {
  const teamName = user.metadata?.team_name;
  return {
    externalUserId: user.user_id,
    displayName: user.display_name ?? null,
    teamName: typeof teamName === "string" ? teamName : null,
    avatar: user.avatar ?? null,
    isOwner: user.is_owner === true,
  };
}

function normalizeRoster(roster: SleeperRoster): NormalizedRoster {
  return {
    externalRosterId: roster.roster_id,
    ownerExternalUserId: roster.owner_id ?? null,
    coOwnerExternalUserIds: roster.co_owners ?? [],
    players: ids(roster.players),
    starters: ids(roster.starters),
    reserve: ids(roster.reserve),
    taxi: ids(roster.taxi),
    keepers: roster.keepers ?? null,
    settings: roster.settings ?? {},
  };
}

function normalizeMatchup(row: SleeperMatchup, plan: ImportCursor["weekPlan"][number]): NormalizedMatchup {
  return {
    externalRosterId: row.roster_id,
    week: plan.week,
    seasonType: plan.seasonType,
    matchupId: row.matchup_id ?? null,
    points: row.points ?? null,
    customPoints: row.custom_points ?? null,
    players: ids(row.players),
    starters: ids(row.starters),
    startersPoints: row.starters_points ?? null,
    playersPoints: row.players_points ?? null,
    isPartial: plan.partial,
  };
}

function resetLeague(cursor: ImportCursor, leagueId: string): void {
  if (cursor.activeLeagueId === leagueId) return;
  cursor.activeLeagueId = leagueId;
  cursor.weekIndex = 0;
  cursor.draftIndex = 0;
  cursor.draftIds = [];
  cursor.weekPlan = [];
  cursor.weekPlanReady = false;
  cursor.previousLeagueId = null;
  cursor.emptyMatchupWeeks = [];
  cursor.unresolvedPlayerIds = [];
  cursor.directoryFetchedAt = null;
  cursor.directoryCache = null;
  cursor.historyNote = null;
}

function accountLeague(cursor: ImportCursor): void {
  if (cursor.accountedLeagues.includes(cursor.leagueIndex)) return;
  const units = 7 + cursor.draftIds.length + cursor.weekPlan.length * 2;
  cursor.totalUnits = (cursor.totalUnits ?? 0) + units;
  cursor.accountedLeagues.push(cursor.leagueIndex);
}

async function freshEnough(
  store: ImportStore,
  cursor: ImportCursor,
  resource: string,
  key: string,
  kind: CacheKind,
  now: Date,
  correction: boolean,
): Promise<boolean> {
  const raw = await store.getRaw(resource, key);
  if (!raw || shouldFetchUpstream(kind, raw.fetchedAt, now, correction)) return false;
  cursor.cacheHits += 1;
  return true;
}

export async function runLeagueImport(options: ImportRunOptions): Promise<ImportRunResult> {
  const cursor = options.cursor ?? initialCursor(options.rootLeagueId);
  let steps = 0;
  while (cursor.stage !== "done") {
    if (steps++ > 5000) throw new Error("Import exceeded the step limit.");
    const leagueId = cursor.leagueQueue[cursor.leagueIndex];
    if (!leagueId) {
      cursor.stage = "done";
      break;
    }
    if (!cursor.visited.includes(leagueId)) cursor.visited.push(leagueId);
    let countUnit = true;
    try {
      countUnit = await executeStage(cursor, leagueId, options);
    } catch (error) {
      if (isRetryableProviderError(error)) throw error;
      if (cursor.leagueIndex === 0 && (cursor.stage === "league" || cursor.stage === "users" || cursor.stage === "rosters")) {
        throw error;
      }
      cursor.notices.push({
        level: "warning",
        code: error instanceof ProviderError ? error.code : "stage_failed",
        message: error instanceof Error ? error.message : "Import step failed.",
      });
      skipFailedUnit(cursor);
    }
    if (countUnit) cursor.completedUnits += 1;
    await options.onProgress?.(structuredClone(cursor));
  }
  const status = cursor.notices.some((notice) => notice.level === "warning") ? "partial" : "succeeded";
  return { cursor, status };
}

function skipFailedUnit(cursor: ImportCursor): void {
  if (cursor.stage === "matchups") {
    cursor.weekIndex += 1;
    if (cursor.weekIndex >= cursor.weekPlan.length) {
      cursor.stage = "transactions";
      cursor.weekIndex = 0;
    }
    return;
  }
  if (cursor.stage === "transactions") {
    cursor.weekIndex += 1;
    if (cursor.weekIndex >= cursor.weekPlan.length) {
      cursor.stage = "players";
      cursor.weekIndex = 0;
    }
    return;
  }
  if (cursor.stage === "draft_detail") {
    cursor.draftIndex += 1;
    if (cursor.draftIndex >= cursor.draftIds.length) cursor.stage = "traded_picks";
    return;
  }
  cursor.stage = "history";
}

async function executeStage(cursor: ImportCursor, leagueId: string, options: ImportRunOptions): Promise<boolean> {
  const { client, store, now, correction } = options;
  switch (cursor.stage) {
    case "league": {
      resetLeague(cursor, leagueId);
      if (!cursor.nflStateLoaded) {
        try {
          const state = await client.getNflState();
          cursor.nflState = {
            season: state.season,
            week: state.week,
            leg: state.leg,
            seasonType: state.season_type,
          };
        } catch (error) {
          if (isRetryableProviderError(error)) throw error;
          cursor.nflState = null;
          cursor.notices.push({
            level: "warning",
            code: "nfl_state_unavailable",
            message: "NFL state could not be loaded. Partial weeks cannot be distinguished.",
          });
        }
        cursor.nflStateLoaded = true;
      }
      const cached = await freshEnough(store, cursor, "league", leagueId, "league_meta", now, correction);
      let context = cached ? await store.getLeagueContext(leagueId) : null;
      if (!context) {
        const league = await client.getLeague(leagueId);
        if (!league) {
          if (cursor.leagueIndex === 0) {
            throw new ProviderError("No league was found for that id.", false, "not_found");
          }
          cursor.notices.push({
            level: "warning",
            code: "history_missing",
            message: `Previous league ${leagueId} was not found.`,
          });
          cursor.stage = "done";
          return true;
        }
        const normalized = normalizeLeague(league, options.isDemo);
        await store.saveRaw("league", leagueId, normalized, now);
        await store.upsertLeague(normalized);
        context = leagueContext(normalized);
      }
      cursor.previousLeagueId = context.previousLeagueId;
      if (!cursor.weekPlanReady) {
        const planned = planWeeks({
          status: context.status,
          season: context.season,
          settings: context.settings,
          nflState: cursor.nflState,
        });
        cursor.weekPlan = planned.weeks;
        cursor.weekPlanReady = true;
        cursor.notices.push(...planned.notices);
        if (context.sport.toLowerCase() !== "nfl") {
          cursor.notices.push({
            level: "warning",
            code: "unsupported_sport",
            message: `This league's sport is ${context.sport}. Football analysis is disabled.`,
          });
        }
      }
      cursor.stage = "users";
      return true;
    }
    case "users": {
      if (!(await freshEnough(store, cursor, "users", leagueId, "league_meta", now, correction))) {
        const users = await client.getLeagueUsers(leagueId);
        await store.saveRaw("users", leagueId, users, now);
        await store.upsertUsers(leagueId, users.map(normalizeUser));
      }
      cursor.stage = "rosters";
      return true;
    }
    case "rosters": {
      if (!(await freshEnough(store, cursor, "rosters", leagueId, "league_meta", now, correction))) {
        const rosters = await client.getRosters(leagueId);
        await store.saveRaw("rosters", leagueId, rosters, now);
        await store.upsertRosters(leagueId, rosters.map(normalizeRoster), now);
      }
      cursor.stage = "draft_list";
      return true;
    }
    case "draft_list": {
      const cached = await freshEnough(store, cursor, "draft_list", leagueId, "league_meta", now, correction);
      if (cached) {
        const raw = await store.getRaw("draft_list", leagueId);
        const idsFromRaw = Array.isArray(raw?.body) ? raw.body.filter((id): id is string => typeof id === "string") : [];
        cursor.draftIds = idsFromRaw;
      } else {
        const drafts = await client.getLeagueDrafts(leagueId);
        cursor.draftIds = drafts.map((draft) => draft.draft_id);
        await store.saveRaw("draft_list", leagueId, cursor.draftIds, now);
      }
      accountLeague(cursor);
      cursor.draftIndex = 0;
      cursor.stage = "draft_detail";
      return true;
    }
    case "draft_detail": {
      if (cursor.draftIndex >= cursor.draftIds.length) {
        cursor.stage = "traded_picks";
        return false;
      }
      const draftId = cursor.draftIds[cursor.draftIndex] ?? "";
      const summaries = await store.listDraftSummaries(leagueId);
      const summary = summaries.find((draft) => draft.id === draftId);
      const kind: CacheKind = summary?.status === "complete" ? "completed_week" : "league_meta";
      if (!(await freshEnough(store, cursor, "draft", draftId, kind, now, correction))) {
        const detail = await client.getDraft(draftId);
        const picks = detail ? await client.getDraftPicks(draftId) : [];
        if (!detail) {
          cursor.notices.push({
            level: "warning",
            code: "draft_missing",
            message: `Draft ${draftId} was not found.`,
          });
        } else {
          await store.saveRaw("draft", draftId, { draftId, status: detail.status }, now);
          await store.upsertDraft(leagueId, toDraft(detail), normalizeDraftPicks(picks, detail.slot_to_roster_id ?? null));
        }
      }
      cursor.draftIndex += 1;
      if (cursor.draftIndex >= cursor.draftIds.length) cursor.stage = "traded_picks";
      return true;
    }
    case "traded_picks": {
      if (!(await freshEnough(store, cursor, "traded_picks", leagueId, "league_meta", now, correction))) {
        const picks = await client.getLeagueTradedPicks(leagueId);
        await store.saveRaw("traded_picks", leagueId, picks, now);
        await store.replaceTradedPicks(
          leagueId,
          picks.map((pick) => ({
            season: String(pick.season),
            round: pick.round,
            originalRosterId: pick.roster_id,
            previousOwnerRosterId: pick.previous_owner_id ?? null,
            ownerRosterId: pick.owner_id,
          })),
        );
      }
      cursor.stage = "matchups";
      cursor.weekIndex = 0;
      return true;
    }
    case "matchups": {
      if (cursor.weekIndex >= cursor.weekPlan.length) {
        cursor.stage = "transactions";
        cursor.weekIndex = 0;
        return false;
      }
      const plan = cursor.weekPlan[cursor.weekIndex];
      if (!plan) {
        cursor.stage = "transactions";
        return false;
      }
      const kind: CacheKind = plan.partial ? "current_week" : "completed_week";
      if (!(await freshEnough(store, cursor, "matchups", `${leagueId}:${plan.week}`, kind, now, correction))) {
        const rows = await client.getMatchups(leagueId, plan.week);
        if (rows.length === 0) {
          cursor.emptyMatchupWeeks.push(plan.week);
          const existing = await store.countMatchups(leagueId, plan.week);
          cursor.notices.push({
            level: "warning",
            code: "empty_matchups",
            message: existing
              ? `Week ${plan.week} returned no matchups. Existing rows were kept.`
              : `Week ${plan.week} returned no matchups.`,
          });
        } else {
          await store.saveRaw("matchups", `${leagueId}:${plan.week}`, rows, now);
          await store.replaceMatchups(leagueId, plan.week, rows.map((row) => normalizeMatchup(row, plan)));
        }
      }
      cursor.weekIndex += 1;
      if (cursor.weekIndex >= cursor.weekPlan.length) {
        cursor.stage = "transactions";
        cursor.weekIndex = 0;
      }
      return true;
    }
    case "transactions": {
      if (cursor.weekIndex >= cursor.weekPlan.length) {
        cursor.stage = "players";
        cursor.weekIndex = 0;
        return false;
      }
      const plan = cursor.weekPlan[cursor.weekIndex];
      if (!plan) {
        cursor.stage = "players";
        return false;
      }
      const kind: CacheKind = plan.partial ? "current_week" : "completed_week";
      if (!(await freshEnough(store, cursor, "transactions", `${leagueId}:${plan.week}`, kind, now, correction))) {
        const rows = await client.getTransactions(leagueId, plan.week);
        const normalized = rows
          .map((row) => normalizeTransaction(row, plan.week))
          .filter((row): row is NonNullable<typeof row> => row !== null);
        await store.saveRaw("transactions", `${leagueId}:${plan.week}`, rows, now);
        await store.replaceTransactions(leagueId, plan.week, normalized);
      }
      cursor.weekIndex += 1;
      if (cursor.weekIndex >= cursor.weekPlan.length) {
        cursor.stage = "players";
        cursor.weekIndex = 0;
      }
      return true;
    }
    case "players": {
      const referenced = (await store.listReferencedPlayerIds(leagueId)).filter((id) => id !== "0");
      const lookup = await options.directory.lookup(referenced);
      cursor.directoryCache = lookup.cache;
      cursor.directoryFetchedAt = lookup.fetchedAt;
      cursor.unresolvedPlayerIds = referenced.filter((id) => !lookup.players.has(id));
      if (lookup.unavailable) {
        cursor.notices.push({
          level: "warning",
          code: "player_directory_unavailable",
          message: "The player directory could not be loaded. Unresolved ids stay visible.",
        });
      } else if (lookup.fetchedAt) {
        await store.upsertPlayers([...lookup.players.values()], new Date(lookup.fetchedAt));
        if (lookup.cache === "stale") {
          cursor.notices.push({
            level: "warning",
            code: "player_directory_stale",
            message: "The player directory refresh failed. A directory older than 24 hours was used.",
          });
        }
      }
      if (cursor.unresolvedPlayerIds.length > 0) {
        cursor.notices.push({
          level: "info",
          code: "unresolved_players",
          message: `${cursor.unresolvedPlayerIds.length} player id${cursor.unresolvedPlayerIds.length === 1 ? " was" : "s were"} not in the directory.`,
        });
      }
      cursor.stage = "history";
      return true;
    }
    case "history": {
      const decision = selectNextHistoryLeague({
        previousLeagueId: cursor.previousLeagueId,
        visited: cursor.visited,
        followed: cursor.leagueIndex,
        limit: options.historyLimit,
      });
      cursor.historyNote = decision.notice?.message ?? null;
      if (decision.notice) cursor.notices.push(decision.notice);
      const completeness: DataCompleteness = {
        matchupWeeksExpected: cursor.weekPlan.length,
        emptyMatchupWeeks: [...cursor.emptyMatchupWeeks],
        partialWeeks: cursor.weekPlan.filter((week) => week.partial).map((week) => week.week),
        unresolvedPlayerIds: [...cursor.unresolvedPlayerIds],
        playerDirectoryFetchedAt: cursor.directoryFetchedAt,
        playerDirectoryCache: cursor.directoryCache,
        historyNote: cursor.historyNote,
      };
      await store.recordCompleteness(leagueId, completeness, now);
      if (decision.nextLeagueId) {
        cursor.leagueQueue.push(decision.nextLeagueId);
        cursor.leagueIndex += 1;
        cursor.stage = "league";
      } else {
        cursor.stage = "done";
      }
      return true;
    }
    default:
      cursor.stage = "done";
      return false;
  }
}

function toDraft(detail: SleeperDraft) {
  return {
    externalDraftId: detail.draft_id,
    status: detail.status,
    type: detail.type,
    sport: detail.sport,
    season: detail.season,
    settings: detail.settings ?? {},
    draftOrder: detail.draft_order ?? null,
    slotToRosterId: detail.slot_to_roster_id ?? null,
    startTime: typeof detail.start_time === "number" ? new Date(detail.start_time) : null,
  };
}
