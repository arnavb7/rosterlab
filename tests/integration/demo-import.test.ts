import { afterAll, beforeAll, expect, it } from "vitest";

import { PLAYER_DIRECTORY_TTL_MS } from "@/domain/cache-policy";
import { prisma } from "@/lib/db";
import { createDemoClient } from "@/fixtures/demo/client";
import { DEMO_CURRENT_LEAGUE_ID, DEMO_ROSTER_ID } from "@/fixtures/demo/world";
import { runLeagueImport } from "@/server/ingestion/import-league";
import { createPrismaImportStore } from "@/server/ingestion/prisma-store";
import { FilePlayerDirectory } from "@/server/players/directory";

const NOW = new Date("2026-10-23T12:00:00Z");

beforeAll(async () => {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "TransactionAsset",
      "LeagueTransaction",
      "DraftPick",
      "Draft",
      "TradedPick",
      "MatchupTeamWeek",
      "RosterSnapshot",
      "LeagueMembership",
      "LeagueSeason",
      "SleeperUser",
      "Player",
      "RawPayload",
      "ImportJob",
      "ProviderCapability",
      "PlayerIdentityMapping"
    RESTART IDENTITY CASCADE
  `);
});

afterAll(async () => {
  await prisma.$disconnect();
});

it("stores the demo import idempotently in PostgreSQL", async () => {
  let file: { fetchedAt: string; players: Record<string, unknown> } | null = null;
  const client = createDemoClient();
  const run = () =>
    runLeagueImport({
      rootLeagueId: DEMO_CURRENT_LEAGUE_ID,
      isDemo: true,
      correction: false,
      historyLimit: 3,
      now: NOW,
      client,
      store: createPrismaImportStore(),
      directory: new FilePlayerDirectory({
        source: "demo",
        now: NOW,
        ttlMs: PLAYER_DIRECTORY_TTL_MS,
        download: () => client.getPlayersNfl(),
        read: async () => file,
        write: async (next) => {
          file = next;
        },
      }),
    });

  const first = await run();
  expect(first.status).toBe("succeeded");
  const transactionCount = await prisma.leagueTransaction.count({
    where: { leagueSeason: { externalLeagueId: DEMO_CURRENT_LEAGUE_ID } },
  });
  const pickCount = await prisma.draftPick.count({
    where: { draft: { externalDraftId: "demo_draft_2025" } },
  });
  expect(transactionCount).toBe(3);
  expect(pickCount).toBe(24);

  await run();
  expect(
    await prisma.leagueTransaction.count({
      where: { leagueSeason: { externalLeagueId: DEMO_CURRENT_LEAGUE_ID } },
    }),
  ).toBe(transactionCount);
  expect(
    await prisma.draftPick.count({
      where: { draft: { externalDraftId: "demo_draft_2025" } },
    }),
  ).toBe(pickCount);

  const roster = await prisma.rosterSnapshot.findFirst({
    where: {
      externalRosterId: DEMO_ROSTER_ID,
      leagueSeason: { externalLeagueId: DEMO_CURRENT_LEAGUE_ID },
    },
  });
  expect(roster?.ownerExternalUserId).toBe("u_rowan");
  expect(roster?.players).toContain("demo-p-trade-in");
  expect(roster?.players).not.toContain("demo-p-trade-away");
  const weekOne = await prisma.matchupTeamWeek.findFirst({
    where: {
      week: 1,
      externalRosterId: DEMO_ROSTER_ID,
      leagueSeason: { externalLeagueId: DEMO_CURRENT_LEAGUE_ID },
    },
  });
  expect(weekOne?.players).toContain("demo-p-trade-away");
  expect(weekOne?.isPartial).toBe(false);
});
