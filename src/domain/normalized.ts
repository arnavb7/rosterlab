import type { NormalizedDraftPick } from "@/domain/draft-picks";
import type { NormalizedTransaction } from "@/domain/transactions";
import type { WeekPlan } from "@/domain/weeks";

export type NormalizedLeague = {
  externalLeagueId: string;
  sport: string;
  season: string;
  name: string;
  status: string;
  seasonType: string | null;
  previousLeagueId: string | null;
  primaryDraftId: string | null;
  avatar: string | null;
  totalRosters: number | null;
  rosterPositions: string[];
  scoringSettings: Record<string, unknown>;
  settings: Record<string, unknown>;
  leagueMetadata: Record<string, unknown> | null;
  isDemo: boolean;
};

export type NormalizedMembership = {
  externalUserId: string;
  displayName: string | null;
  teamName: string | null;
  avatar: string | null;
  isOwner: boolean;
};

export type NormalizedRoster = {
  externalRosterId: number;
  ownerExternalUserId: string | null;
  coOwnerExternalUserIds: string[];
  players: string[];
  starters: string[];
  reserve: string[];
  taxi: string[];
  keepers: unknown;
  settings: Record<string, unknown>;
};

export type NormalizedDraft = {
  externalDraftId: string;
  status: string;
  type: string;
  sport: string;
  season: string;
  settings: Record<string, unknown>;
  draftOrder: Record<string, number> | null;
  slotToRosterId: Record<string, number> | null;
  startTime: Date | null;
};

export type NormalizedTradedPick = {
  season: string;
  round: number;
  originalRosterId: number;
  previousOwnerRosterId: number | null;
  ownerRosterId: number;
};

export type NormalizedMatchup = {
  externalRosterId: number;
  week: number;
  seasonType: "regular" | "post";
  matchupId: number | null;
  points: number | null;
  customPoints: number | null;
  players: string[];
  starters: string[];
  startersPoints: (number | null)[] | null;
  playersPoints: Record<string, number | null> | null;
  isPartial: boolean;
};

export type NormalizedPlayer = {
  sleeperId: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  position: string | null;
  fantasyPositions: string[];
  team: string | null;
  status: string | null;
  injuryStatus: string | null;
  searchRank: number | null;
  source: "sleeper" | "demo";
};

export type LeagueContext = {
  previousLeagueId: string | null;
  status: string;
  season: string;
  sport: string;
  settings: Record<string, unknown>;
  scoringSettings: Record<string, unknown>;
  rosterPositions: string[];
};

export type DataCompleteness = {
  matchupWeeksExpected: number;
  emptyMatchupWeeks: number[];
  partialWeeks: number[];
  unresolvedPlayerIds: string[];
  playerDirectoryFetchedAt: string | null;
  playerDirectoryCache: string | null;
  historyNote: string | null;
};

export type StoredDraft = {
  draft: NormalizedDraft;
  picks: NormalizedDraftPick[];
};

export type ImportNotice = {
  level: "info" | "warning";
  code: string;
  message: string;
};

export type ImportStage =
  | "league"
  | "users"
  | "rosters"
  | "draft_list"
  | "draft_detail"
  | "traded_picks"
  | "matchups"
  | "transactions"
  | "players"
  | "history"
  | "done";

export type ImportCursor = {
  version: 1;
  leagueQueue: string[];
  leagueIndex: number;
  visited: string[];
  stage: ImportStage;
  weekIndex: number;
  draftIndex: number;
  draftIds: string[];
  weekPlan: WeekPlan[];
  weekPlanReady: boolean;
  previousLeagueId: string | null;
  nflState: { season: string; week: number; leg: number; seasonType: string } | null;
  nflStateLoaded: boolean;
  activeLeagueId: string | null;
  notices: ImportNotice[];
  completedUnits: number;
  totalUnits: number | null;
  accountedLeagues: number[];
  cacheHits: number;
  emptyMatchupWeeks: number[];
  unresolvedPlayerIds: string[];
  directoryFetchedAt: string | null;
  directoryCache: string | null;
  historyNote: string | null;
};

export function initialCursor(leagueId: string): ImportCursor {
  return {
    version: 1,
    leagueQueue: [leagueId],
    leagueIndex: 0,
    visited: [],
    stage: "league",
    weekIndex: 0,
    draftIndex: 0,
    draftIds: [],
    weekPlan: [],
    weekPlanReady: false,
    previousLeagueId: null,
    nflState: null,
    nflStateLoaded: false,
    activeLeagueId: null,
    notices: [],
    completedUnits: 0,
    totalUnits: null,
    accountedLeagues: [],
    cacheHits: 0,
    emptyMatchupWeeks: [],
    unresolvedPlayerIds: [],
    directoryFetchedAt: null,
    directoryCache: null,
    historyNote: null,
  };
}

export type { NormalizedDraftPick, NormalizedTransaction };
