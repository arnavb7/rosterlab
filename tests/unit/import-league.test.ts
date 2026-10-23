import { describe, expect, it } from "vitest";

import { PLAYER_DIRECTORY_TTL_MS } from "@/domain/cache-policy";
import { initialCursor, type ImportCursor } from "@/domain/normalized";
import { playerFieldsForView } from "@/server/queries/team-view";
import { createDemoClient } from "@/fixtures/demo/client";
import { DEMO_CURRENT_LEAGUE_ID, DEMO_PREVIOUS_LEAGUE_ID, DEMO_ROSTER_ID } from "@/fixtures/demo/world";
import { runLeagueImport } from "@/server/ingestion/import-league";
import { MemoryImportStore } from "@/server/ingestion/memory-store";
import { FilePlayerDirectory } from "@/server/players/directory";
import type { SleeperClient } from "@/server/providers/sleeper/client";
import { assertJobProvider } from "@/server/jobs/queue";

const NOW = new Date("2026-10-23T12:00:00Z");

function countingClient() {
  const calls: string[] = [];
  const base = createDemoClient();
  const client: SleeperClient = {
    ...base,
    async getLeague(leagueId) {
      calls.push(`getLeague:${leagueId}`);
      return base.getLeague(leagueId);
    },
    async getMatchups(leagueId, week) {
      calls.push(`getMatchups:${leagueId}:${week}`);
      return base.getMatchups(leagueId, week);
    },
    async getPlayersNfl() {
      calls.push("getPlayersNfl");
      return base.getPlayersNfl();
    },
  };
  return { client, calls };
}

function directoryFor(client: SleeperClient, now: Date) {
  let file: { fetchedAt: string; players: Record<string, unknown> } | null = null;
  return new FilePlayerDirectory({
    source: "demo",
    now,
    ttlMs: PLAYER_DIRECTORY_TTL_MS,
    download: () => client.getPlayersNfl(),
    read: async () => file,
    write: async (next) => {
      file = next;
    },
  });
}

async function importDemo(options?: { now?: Date; correction?: boolean; cursor?: ImportCursor }) {
  const now = options?.now ?? NOW;
  const counted = countingClient();
  const store = new MemoryImportStore();
  const result = await runLeagueImport({
    rootLeagueId: DEMO_CURRENT_LEAGUE_ID,
    isDemo: true,
    correction: options?.correction ?? false,
    historyLimit: 3,
    now,
    client: counted.client,
    store,
    directory: directoryFor(counted.client, now),
    cursor: options?.cursor,
    onProgress: async () => {},
  });
  return { result, store, calls: counted.calls, client: counted.client };
}

describe("demo league import", () => {
  it("imports roster, matchups, and drafts through the same pipeline as live data", async () => {
    const { result, store } = await importDemo();
    expect(result.status).toBe("succeeded");
    expect(result.cursor.completedUnits).toBe(result.cursor.totalUnits);
    const league = store.leagues.get(DEMO_CURRENT_LEAGUE_ID);
    expect(league?.isDemo).toBe(true);
    expect(league?.name).toBe("Northwind Sunday League");

    const current = store.rosters.get(DEMO_CURRENT_LEAGUE_ID)?.find((roster) => roster.externalRosterId === DEMO_ROSTER_ID);
    const previous = store.rosters.get(DEMO_PREVIOUS_LEAGUE_ID)?.find((roster) => roster.externalRosterId === 1);
    expect(current?.ownerExternalUserId).toBe("u_rowan");
    expect(previous?.ownerExternalUserId).toBe("u_quinn");
    expect(current?.players).toContain("demo-p-trade-in");
    expect(current?.players).not.toContain("demo-p-trade-away");
    expect(current?.coOwnerExternalUserIds).toEqual([]);
    expect(store.rosters.get(DEMO_CURRENT_LEAGUE_ID)?.find((roster) => roster.externalRosterId === 4)?.ownerExternalUserId).toBeNull();

    const weekOne = store.matchups
      .get(DEMO_CURRENT_LEAGUE_ID)
      ?.find((matchup) => matchup.week === 1 && matchup.externalRosterId === 1);
    const weekSix = store.matchups
      .get(DEMO_CURRENT_LEAGUE_ID)
      ?.find((matchup) => matchup.week === 6 && matchup.externalRosterId === 1);
    expect(weekOne?.players).toContain("demo-p-trade-away");
    expect(weekOne?.isPartial).toBe(false);
    expect(weekSix?.isPartial).toBe(true);

    const transactions = store.transactions.get(DEMO_CURRENT_LEAGUE_ID) ?? [];
    expect(transactions.find((item) => item.externalTransactionId === "demo-tx-failed")?.executed).toBe(false);
    expect(transactions.find((item) => item.externalTransactionId === "demo-tx-trade")?.executed).toBe(true);
    expect(transactions.filter((item) => item.executed)).toHaveLength(2);

    const first = store.drafts.get("demo_draft_2025")?.picks.find((pick) => pick.pickNo === 1);
    expect(first?.draftSlot).toBe(1);
    expect(first?.rosterId).toBe(3);
    expect(first?.attributionSource).toBe("slot_to_roster_id");
    const slotted = store.drafts.get("demo_draft_2025")?.picks.find((pick) => pick.round === 1 && pick.draftSlot === 2);
    expect(slotted?.rosterId).toBe(1);
    expect(slotted?.attributionSource).toBe("pick.roster_id");
    expect(
      store.drafts.get("demo_draft_supp")?.picks.every((pick) => pick.irregularities.includes("duplicate_pick_no")),
    ).toBe(true);

    expect(store.players.get("demo-p-r1-qb")?.searchRank).toBe(4242);
    expect(store.players.has("demo-p-missing")).toBe(false);
    expect(store.completeness.get(DEMO_CURRENT_LEAGUE_ID)?.unresolvedPlayerIds).toContain("demo-p-missing");
    expect(result.cursor.notices.some((notice) => notice.code === "history_cycle")).toBe(true);
    expect(store.leagues.get(DEMO_PREVIOUS_LEAGUE_ID)?.settings).toMatchObject({ type: 2 });
    expect(playerFieldsForView).not.toContain("searchRank");
  });

  it("is idempotent and respects cache windows", async () => {
    const counted = countingClient();
    const store = new MemoryImportStore();
    const directory = directoryFor(counted.client, NOW);
    const base = {
      rootLeagueId: DEMO_CURRENT_LEAGUE_ID,
      isDemo: true,
      historyLimit: 3,
      client: counted.client,
      store,
      directory,
      onProgress: async () => {},
    };
    await runLeagueImport({ ...base, correction: false, now: NOW });
    counted.calls.length = 0;
    await runLeagueImport({ ...base, correction: false, now: NOW, cursor: initialCursor(DEMO_CURRENT_LEAGUE_ID) });
    expect(counted.calls.filter((call) => call.startsWith("getMatchups"))).toEqual([]);
    expect(counted.calls.filter((call) => call === "getPlayersNfl")).toEqual([]);

    counted.calls.length = 0;
    await runLeagueImport({
      ...base,
      correction: true,
      now: NOW,
      cursor: initialCursor(DEMO_CURRENT_LEAGUE_ID),
    });
    const corrected = counted.calls.filter((call) => call.startsWith("getMatchups"));
    expect(corrected).toContain(`getMatchups:${DEMO_CURRENT_LEAGUE_ID}:1`);
    expect(corrected).not.toContain(`getMatchups:${DEMO_CURRENT_LEAGUE_ID}:6`);
    expect(counted.calls.filter((call) => call === "getPlayersNfl")).toEqual([]);

    counted.calls.length = 0;
    const later = new Date(NOW.getTime() + 16 * 60 * 1000);
    await runLeagueImport({
      ...base,
      correction: false,
      now: later,
      cursor: initialCursor(DEMO_CURRENT_LEAGUE_ID),
    });
    expect(counted.calls.filter((call) => call.startsWith("getMatchups"))).toEqual([
      `getMatchups:${DEMO_CURRENT_LEAGUE_ID}:6`,
    ]);
    expect(counted.calls.filter((call) => call === "getPlayersNfl")).toEqual([]);

    const rosterCount = store.rosters.get(DEMO_CURRENT_LEAGUE_ID)?.length;
    await runLeagueImport({ ...base, correction: false, now: NOW, cursor: initialCursor(DEMO_CURRENT_LEAGUE_ID) });
    expect(store.rosters.get(DEMO_CURRENT_LEAGUE_ID)?.length).toBe(rosterCount);
    expect(store.transactions.get(DEMO_CURRENT_LEAGUE_ID)?.filter((item) => item.externalTransactionId === "demo-tx-trade")).toHaveLength(1);
  });

  it("resumes after a crash without repeating finished matchup weeks", async () => {
    const { client, calls } = countingClient();
    const store = new MemoryImportStore();
    let saved: ImportCursor | null = null;
    let crashed = false;
    await expect(
      runLeagueImport({
        rootLeagueId: DEMO_CURRENT_LEAGUE_ID,
        isDemo: true,
        correction: false,
        historyLimit: 3,
        now: NOW,
        client,
        store,
        directory: directoryFor(client, NOW),
        onProgress: async (cursor) => {
          saved = structuredClone(cursor);
          if (!crashed && cursor.stage === "matchups" && cursor.weekIndex === 2 && cursor.leagueIndex === 0) {
            crashed = true;
            throw new Error("crash");
          }
        },
      }),
    ).rejects.toThrow("crash");
    expect(saved).not.toBeNull();
    await runLeagueImport({
      rootLeagueId: DEMO_CURRENT_LEAGUE_ID,
      isDemo: true,
      correction: false,
      historyLimit: 3,
      now: NOW,
      client,
      store,
      directory: directoryFor(client, NOW),
      cursor: saved ?? undefined,
      onProgress: async () => {},
    });
    const weekOne = calls.filter((call) => call === `getMatchups:${DEMO_CURRENT_LEAGUE_ID}:1`);
    expect(weekOne).toHaveLength(1);
    expect(store.matchups.get(DEMO_CURRENT_LEAGUE_ID)?.some((matchup) => matchup.week === 6)).toBe(true);
  });
});

describe("job provider guard", () => {
  it("refuses to mix demo jobs with live league ids", () => {
    expect(() => assertJobProvider({ isDemo: true, externalLeagueId: "12345" })).toThrow(/Demo jobs/);
    expect(() => assertJobProvider({ isDemo: false, externalLeagueId: DEMO_CURRENT_LEAGUE_ID })).toThrow(/not requested/);
    expect(() => assertJobProvider({ isDemo: true, externalLeagueId: DEMO_CURRENT_LEAGUE_ID })).not.toThrow();
  });
});
