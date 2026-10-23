import { Prisma } from "@prisma/client";

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
import { prisma } from "@/lib/db";
import { asRecord } from "@/lib/utils";
import { ProviderError } from "@/server/providers/errors";
import type { ImportStore, RawRecord } from "@/server/ingestion/store";

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function jsonOrDbNull(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (value === null || value === undefined) return Prisma.DbNull;
  return json(value);
}

async function requireLeague(externalLeagueId: string) {
  const league = await prisma.leagueSeason.findUnique({ where: { externalLeagueId } });
  if (!league) throw new ProviderError(`League ${externalLeagueId} is not stored yet.`, false, "missing_league");
  return league;
}

export function createPrismaImportStore(): ImportStore {
  return {
    async upsertLeague(league) {
      const existing = await prisma.leagueSeason.findUnique({
        where: { externalLeagueId: league.externalLeagueId },
        select: { isDemo: true },
      });
      if (existing && existing.isDemo !== league.isDemo) {
        throw new ProviderError("Demo and live league data cannot be mixed.", false, "mixed_data");
      }
      await prisma.leagueSeason.upsert({
        where: { externalLeagueId: league.externalLeagueId },
        create: {
          externalLeagueId: league.externalLeagueId,
          sport: league.sport,
          season: league.season,
          name: league.name,
          status: league.status,
          seasonType: league.seasonType,
          previousLeagueId: league.previousLeagueId,
          primaryDraftId: league.primaryDraftId,
          avatar: league.avatar,
          totalRosters: league.totalRosters,
          rosterPositions: json(league.rosterPositions),
          scoringSettings: json(league.scoringSettings),
          settings: json(league.settings),
          leagueMetadata: jsonOrDbNull(league.leagueMetadata),
          isDemo: league.isDemo,
        },
        update: {
          sport: league.sport,
          season: league.season,
          name: league.name,
          status: league.status,
          seasonType: league.seasonType,
          previousLeagueId: league.previousLeagueId,
          primaryDraftId: league.primaryDraftId,
          avatar: league.avatar,
          totalRosters: league.totalRosters,
          rosterPositions: json(league.rosterPositions),
          scoringSettings: json(league.scoringSettings),
          settings: json(league.settings),
          leagueMetadata: jsonOrDbNull(league.leagueMetadata),
        },
      });
    },

    async upsertUsers(leagueExternalId, users) {
      const league = await requireLeague(leagueExternalId);
      for (const user of users) {
        const sleeperUser = await prisma.sleeperUser.upsert({
          where: { externalId: user.externalUserId },
          create: {
            externalId: user.externalUserId,
            displayName: user.displayName,
            avatar: user.avatar,
          },
          update: {
            displayName: user.displayName,
            avatar: user.avatar,
          },
        });
        await prisma.leagueMembership.upsert({
          where: {
            leagueSeasonId_externalUserId: {
              leagueSeasonId: league.id,
              externalUserId: user.externalUserId,
            },
          },
          create: {
            leagueSeasonId: league.id,
            sleeperUserId: sleeperUser.id,
            externalUserId: user.externalUserId,
            displayName: user.displayName,
            teamName: user.teamName,
            avatar: user.avatar,
            isOwner: user.isOwner,
          },
          update: {
            sleeperUserId: sleeperUser.id,
            displayName: user.displayName,
            teamName: user.teamName,
            avatar: user.avatar,
            isOwner: user.isOwner,
          },
        });
      }
    },

    async upsertRosters(leagueExternalId, rosters, asOf) {
      const league = await requireLeague(leagueExternalId);
      for (const roster of rosters) {
        await prisma.rosterSnapshot.upsert({
          where: {
            leagueSeasonId_externalRosterId_snapshotKind: {
              leagueSeasonId: league.id,
              externalRosterId: roster.externalRosterId,
              snapshotKind: "CURRENT",
            },
          },
          create: rosterData(league.id, roster, asOf),
          update: rosterData(league.id, roster, asOf),
        });
      }
    },

    async upsertDraft(leagueExternalId, draft, picks) {
      const league = await requireLeague(leagueExternalId);
      await prisma.$transaction(async (tx) => {
        const saved = await tx.draft.upsert({
          where: { externalDraftId: draft.externalDraftId },
          create: draftData(league.id, draft),
          update: draftData(league.id, draft),
        });
        await tx.draftPick.deleteMany({ where: { draftId: saved.id } });
        if (picks.length > 0) {
          await tx.draftPick.createMany({
            data: picks.map((pick) => ({
              draftId: saved.id,
              ordinal: pick.ordinal,
              pickNo: pick.pickNo,
              round: pick.round,
              draftSlot: pick.draftSlot,
              rosterId: pick.rosterId,
              attributionSource: pick.attributionSource,
              playerExternalId: pick.playerExternalId,
              pickedByExternalUserId: pick.pickedByExternalUserId,
              isKeeper: pick.isKeeper,
              playerName: pick.playerName,
              position: pick.position,
              nflTeam: pick.nflTeam,
              irregularities: pick.irregularities,
            })),
          });
        }
      });
    },

    async replaceTradedPicks(leagueExternalId, picks) {
      const league = await requireLeague(leagueExternalId);
      await prisma.$transaction(async (tx) => {
        await tx.tradedPick.deleteMany({ where: { leagueSeasonId: league.id } });
        if (picks.length > 0) {
          await tx.tradedPick.createMany({
            data: picks.map((pick) => ({
              leagueSeasonId: league.id,
              season: pick.season,
              round: pick.round,
              originalRosterId: pick.originalRosterId,
              previousOwnerRosterId: pick.previousOwnerRosterId,
              ownerRosterId: pick.ownerRosterId,
            })),
          });
        }
      });
    },

    async replaceMatchups(leagueExternalId, week, rows) {
      const league = await requireLeague(leagueExternalId);
      await prisma.$transaction(async (tx) => {
        await tx.matchupTeamWeek.deleteMany({ where: { leagueSeasonId: league.id, week } });
        if (rows.length > 0) {
          await tx.matchupTeamWeek.createMany({
            data: rows.map((row) => ({
              leagueSeasonId: league.id,
              externalRosterId: row.externalRosterId,
              week: row.week,
              seasonType: row.seasonType,
              matchupId: row.matchupId,
              points: row.points,
              customPoints: row.customPoints,
              players: row.players,
              starters: row.starters,
              startersPoints: jsonOrDbNull(row.startersPoints),
              playersPoints: jsonOrDbNull(row.playersPoints),
              isPartial: row.isPartial,
              source: "sleeper",
            })),
          });
        }
      });
    },

    async countMatchups(leagueExternalId, week) {
      const league = await prisma.leagueSeason.findUnique({
        where: { externalLeagueId: leagueExternalId },
        select: { id: true },
      });
      if (!league) return 0;
      return prisma.matchupTeamWeek.count({ where: { leagueSeasonId: league.id, week } });
    },

    async replaceTransactions(leagueExternalId, week, rows) {
      const league = await requireLeague(leagueExternalId);
      await prisma.$transaction(async (tx) => {
        await tx.leagueTransaction.deleteMany({
          where: {
            leagueSeasonId: league.id,
            OR: [
              { importedWeek: week },
              { externalTransactionId: { in: rows.map((row) => row.externalTransactionId) } },
            ],
          },
        });
        for (const row of rows) {
          await tx.leagueTransaction.create({
            data: {
              leagueSeasonId: league.id,
              externalTransactionId: row.externalTransactionId,
              type: row.type,
              status: row.status,
              executed: row.executed,
              week: row.week,
              importedWeek: row.importedWeek,
              rosterIds: row.rosterIds,
              consenterIds: row.consenterIds,
              creatorExternalUserId: row.creatorExternalUserId,
              createdAtSource: row.createdAtSource,
              statusUpdatedAtSource: row.statusUpdatedAtSource,
              settings: jsonOrDbNull(row.settings),
              metadata: jsonOrDbNull(row.metadata),
              source: "sleeper",
              assets: { create: row.assets },
            },
          });
        }
      });
    },

    async upsertPlayers(players, directoryFetchedAt) {
      for (const player of players) {
        await prisma.player.upsert({
          where: { sleeperId: player.sleeperId },
          create: { ...playerFields(player), directoryFetchedAt },
          update: { ...playerFields(player), directoryFetchedAt },
        });
      }
    },

    async saveRaw(resource, key, body, fetchedAt) {
      await prisma.rawPayload.upsert({
        where: {
          provider_resource_externalKey: {
            provider: "sleeper",
            resource,
            externalKey: key,
          },
        },
        create: {
          provider: "sleeper",
          resource,
          externalKey: key,
          body: json(body),
          fetchedAt,
        },
        update: { body: json(body), fetchedAt },
      });
    },

    async getRaw(resource, key): Promise<RawRecord | null> {
      const row = await prisma.rawPayload.findUnique({
        where: {
          provider_resource_externalKey: {
            provider: "sleeper",
            resource,
            externalKey: key,
          },
        },
      });
      return row ? { fetchedAt: row.fetchedAt, body: row.body } : null;
    },

    async getLeagueContext(leagueExternalId): Promise<LeagueContext | null> {
      const league = await prisma.leagueSeason.findUnique({ where: { externalLeagueId: leagueExternalId } });
      if (!league) return null;
      return {
        previousLeagueId: league.previousLeagueId,
        status: league.status,
        season: league.season,
        sport: league.sport,
        settings: asRecord(league.settings),
        scoringSettings: asRecord(league.scoringSettings),
        rosterPositions: Array.isArray(league.rosterPositions)
          ? league.rosterPositions.filter((item): item is string => typeof item === "string")
          : [],
      };
    },

    async listDraftSummaries(leagueExternalId) {
      const league = await prisma.leagueSeason.findUnique({
        where: { externalLeagueId: leagueExternalId },
        select: { id: true },
      });
      if (!league) return [];
      const drafts = await prisma.draft.findMany({
        where: { leagueSeasonId: league.id },
        select: { externalDraftId: true, status: true },
      });
      return drafts.map((draft) => ({ id: draft.externalDraftId, status: draft.status }));
    },

    async listReferencedPlayerIds(leagueExternalId) {
      const league = await prisma.leagueSeason.findUnique({ where: { externalLeagueId: leagueExternalId } });
      if (!league) return [];
      const [rosters, drafts, matchups, transactions] = await Promise.all([
        prisma.rosterSnapshot.findMany({ where: { leagueSeasonId: league.id } }),
        prisma.draft.findMany({ where: { leagueSeasonId: league.id }, include: { picks: true } }),
        prisma.matchupTeamWeek.findMany({ where: { leagueSeasonId: league.id } }),
        prisma.leagueTransaction.findMany({ where: { leagueSeasonId: league.id }, include: { assets: true } }),
      ]);
      const ids = new Set<string>();
      for (const roster of rosters) {
        for (const id of [...roster.players, ...roster.starters, ...roster.reserve, ...roster.taxi]) ids.add(id);
      }
      for (const draft of drafts) {
        for (const pick of draft.picks) {
          if (pick.playerExternalId) ids.add(pick.playerExternalId);
        }
      }
      for (const matchup of matchups) {
        for (const id of [...matchup.players, ...matchup.starters]) ids.add(id);
      }
      for (const transaction of transactions) {
        for (const asset of transaction.assets) {
          if (asset.playerExternalId) ids.add(asset.playerExternalId);
        }
      }
      return [...ids];
    },

    async recordCompleteness(leagueExternalId, completeness, syncedAt) {
      await prisma.leagueSeason.update({
        where: { externalLeagueId: leagueExternalId },
        data: { dataCompleteness: json(completeness), lastSyncedAt: syncedAt },
      });
    },
  };
}

function rosterData(leagueSeasonId: string, roster: NormalizedRoster, asOf: Date) {
  return {
    leagueSeasonId,
    externalRosterId: roster.externalRosterId,
    ownerExternalUserId: roster.ownerExternalUserId,
    coOwnerExternalUserIds: roster.coOwnerExternalUserIds,
    players: roster.players,
    starters: roster.starters,
    reserve: roster.reserve,
    taxi: roster.taxi,
    keepers: jsonOrDbNull(roster.keepers),
    settings: json(roster.settings),
    snapshotKind: "CURRENT",
    asOf,
    source: "sleeper",
    incomplete: true,
    incompleteReason: "Current Sleeper roster endpoint. This is not a historical roster snapshot.",
  };
}

function draftData(leagueSeasonId: string, draft: NormalizedDraft) {
  return {
    leagueSeasonId,
    externalDraftId: draft.externalDraftId,
    status: draft.status,
    type: draft.type,
    sport: draft.sport,
    season: draft.season,
    settings: json(draft.settings),
    draftOrder: jsonOrDbNull(draft.draftOrder),
    slotToRosterId: jsonOrDbNull(draft.slotToRosterId),
    startTime: draft.startTime,
    source: "sleeper",
  };
}

function playerFields(player: NormalizedPlayer) {
  return {
    sleeperId: player.sleeperId,
    firstName: player.firstName,
    lastName: player.lastName,
    fullName: player.fullName,
    position: player.position,
    fantasyPositions: player.fantasyPositions,
    team: player.team,
    status: player.status,
    injuryStatus: player.injuryStatus,
    searchRank: player.searchRank,
    source: player.source,
  };
}

export type { NormalizedLeague, NormalizedMembership, NormalizedRoster, NormalizedDraft, NormalizedDraftPick, NormalizedTradedPick, NormalizedMatchup, NormalizedTransaction, NormalizedPlayer, DataCompleteness };
