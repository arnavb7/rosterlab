import type {
  DataCompleteness,
  LeagueContext,
  NormalizedDraft,
  NormalizedDraftPick,
  NormalizedLeague,
  NormalizedMatchup,
  NormalizedMembership,
  NormalizedPlayer,
  NormalizedRoster,
  NormalizedTradedPick,
  NormalizedTransaction,
} from "@/domain/normalized";

export type RawRecord = {
  fetchedAt: Date;
  body: unknown;
};

export type ImportStore = {
  upsertLeague(league: NormalizedLeague): Promise<void>;
  upsertUsers(leagueExternalId: string, users: NormalizedMembership[]): Promise<void>;
  upsertRosters(leagueExternalId: string, rosters: NormalizedRoster[], asOf: Date): Promise<void>;
  upsertDraft(leagueExternalId: string, draft: NormalizedDraft, picks: NormalizedDraftPick[]): Promise<void>;
  replaceTradedPicks(leagueExternalId: string, picks: NormalizedTradedPick[]): Promise<void>;
  replaceMatchups(leagueExternalId: string, week: number, rows: NormalizedMatchup[]): Promise<void>;
  countMatchups(leagueExternalId: string, week: number): Promise<number>;
  replaceTransactions(leagueExternalId: string, week: number, rows: NormalizedTransaction[]): Promise<void>;
  upsertPlayers(players: NormalizedPlayer[], directoryFetchedAt: Date): Promise<void>;
  saveRaw(resource: string, key: string, body: unknown, fetchedAt: Date): Promise<void>;
  getRaw(resource: string, key: string): Promise<RawRecord | null>;
  getLeagueContext(leagueExternalId: string): Promise<LeagueContext | null>;
  listDraftSummaries(leagueExternalId: string): Promise<{ id: string; status: string }[]>;
  listReferencedPlayerIds(leagueExternalId: string): Promise<string[]>;
  recordCompleteness(leagueExternalId: string, completeness: DataCompleteness, syncedAt: Date): Promise<void>;
};
