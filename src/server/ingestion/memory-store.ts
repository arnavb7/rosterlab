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
import { ProviderError } from "@/server/providers/errors";
import type { ImportStore, RawRecord } from "@/server/ingestion/store";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class MemoryImportStore implements ImportStore {
  readonly leagues = new Map<string, NormalizedLeague>();
  readonly users = new Map<string, NormalizedMembership[]>();
  readonly rosters = new Map<string, NormalizedRoster[]>();
  readonly drafts = new Map<string, { leagueId: string; draft: NormalizedDraft; picks: NormalizedDraftPick[] }>();
  readonly tradedPicks = new Map<string, NormalizedTradedPick[]>();
  readonly matchups = new Map<string, NormalizedMatchup[]>();
  readonly transactions = new Map<string, NormalizedTransaction[]>();
  readonly players = new Map<string, NormalizedPlayer>();
  readonly raw = new Map<string, RawRecord>();
  readonly completeness = new Map<string, DataCompleteness>();

  async upsertLeague(league: NormalizedLeague): Promise<void> {
    const existing = this.leagues.get(league.externalLeagueId);
    if (existing && existing.isDemo !== league.isDemo) {
      throw new ProviderError("Demo and live league data cannot be mixed.", false, "mixed_data");
    }
    this.leagues.set(league.externalLeagueId, clone(league));
  }

  async upsertUsers(leagueExternalId: string, users: NormalizedMembership[]): Promise<void> {
    this.users.set(leagueExternalId, clone(users));
  }

  async upsertRosters(leagueExternalId: string, rosters: NormalizedRoster[], asOf: Date): Promise<void> {
    void asOf;
    this.rosters.set(leagueExternalId, clone(rosters));
  }

  async upsertDraft(leagueExternalId: string, draft: NormalizedDraft, picks: NormalizedDraftPick[]): Promise<void> {
    this.drafts.set(draft.externalDraftId, { leagueId: leagueExternalId, draft: clone(draft), picks: clone(picks) });
  }

  async replaceTradedPicks(leagueExternalId: string, picks: NormalizedTradedPick[]): Promise<void> {
    this.tradedPicks.set(leagueExternalId, clone(picks));
  }

  async replaceMatchups(leagueExternalId: string, week: number, rows: NormalizedMatchup[]): Promise<void> {
    const kept = (this.matchups.get(leagueExternalId) ?? []).filter((row) => row.week !== week);
    this.matchups.set(leagueExternalId, [...kept, ...clone(rows)]);
  }

  async countMatchups(leagueExternalId: string, week: number): Promise<number> {
    return (this.matchups.get(leagueExternalId) ?? []).filter((row) => row.week === week).length;
  }

  async replaceTransactions(leagueExternalId: string, week: number, rows: NormalizedTransaction[]): Promise<void> {
    const kept = (this.transactions.get(leagueExternalId) ?? []).filter((row) => row.importedWeek !== week);
    this.transactions.set(leagueExternalId, [...kept, ...clone(rows)]);
  }

  async upsertPlayers(players: NormalizedPlayer[], directoryFetchedAt: Date): Promise<void> {
    void directoryFetchedAt;
    for (const player of players) this.players.set(player.sleeperId, clone(player));
  }

  async saveRaw(resource: string, key: string, body: unknown, fetchedAt: Date): Promise<void> {
    this.raw.set(`${resource}:${key}`, { fetchedAt: new Date(fetchedAt), body: clone(body) });
  }

  async getRaw(resource: string, key: string): Promise<RawRecord | null> {
    const record = this.raw.get(`${resource}:${key}`);
    return record ? { fetchedAt: new Date(record.fetchedAt), body: clone(record.body) } : null;
  }

  async getLeagueContext(leagueExternalId: string): Promise<LeagueContext | null> {
    const league = this.leagues.get(leagueExternalId);
    if (!league) return null;
    return {
      previousLeagueId: league.previousLeagueId,
      status: league.status,
      season: league.season,
      sport: league.sport,
      settings: clone(league.settings),
      scoringSettings: clone(league.scoringSettings),
      rosterPositions: [...league.rosterPositions],
    };
  }

  async listDraftSummaries(leagueExternalId: string): Promise<{ id: string; status: string }[]> {
    return [...this.drafts.values()]
      .filter((draft) => draft.leagueId === leagueExternalId)
      .map((draft) => ({ id: draft.draft.externalDraftId, status: draft.draft.status }));
  }

  async listReferencedPlayerIds(leagueExternalId: string): Promise<string[]> {
    const ids = new Set<string>();
    for (const roster of this.rosters.get(leagueExternalId) ?? []) {
      for (const id of [...roster.players, ...roster.starters, ...roster.reserve, ...roster.taxi]) ids.add(id);
    }
    for (const draft of this.drafts.values()) {
      if (draft.leagueId !== leagueExternalId) continue;
      for (const pick of draft.picks) {
        if (pick.playerExternalId) ids.add(pick.playerExternalId);
      }
    }
    for (const matchup of this.matchups.get(leagueExternalId) ?? []) {
      for (const id of [...matchup.players, ...matchup.starters]) ids.add(id);
    }
    for (const transaction of this.transactions.get(leagueExternalId) ?? []) {
      for (const asset of transaction.assets) {
        if (asset.playerExternalId) ids.add(asset.playerExternalId);
      }
    }
    return [...ids];
  }

  async recordCompleteness(leagueExternalId: string, completeness: DataCompleteness, syncedAt: Date): Promise<void> {
    void syncedAt;
    this.completeness.set(leagueExternalId, clone(completeness));
  }
}
