import type { DataCompleteness } from "@/domain/normalized";
import { prisma } from "@/lib/db";
import { asRecord, stringList } from "@/lib/utils";
import { toTeamView, type TeamSource, type TeamView } from "@/server/queries/team-view";

function numberList(value: unknown): (number | null)[] | null {
  if (!Array.isArray(value)) return null;
  return value.map((item) => (typeof item === "number" ? item : null));
}

function completeness(value: unknown): DataCompleteness | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Partial<DataCompleteness>;
  if (!Array.isArray(record.emptyMatchupWeeks) || !Array.isArray(record.unresolvedPlayerIds)) return null;
  return {
    matchupWeeksExpected: typeof record.matchupWeeksExpected === "number" ? record.matchupWeeksExpected : 0,
    emptyMatchupWeeks: record.emptyMatchupWeeks.filter((item): item is number => typeof item === "number"),
    partialWeeks: Array.isArray(record.partialWeeks)
      ? record.partialWeeks.filter((item): item is number => typeof item === "number")
      : [],
    unresolvedPlayerIds: record.unresolvedPlayerIds.filter((item): item is string => typeof item === "string"),
    playerDirectoryFetchedAt: typeof record.playerDirectoryFetchedAt === "string" ? record.playerDirectoryFetchedAt : null,
    playerDirectoryCache: typeof record.playerDirectoryCache === "string" ? record.playerDirectoryCache : null,
    historyNote: typeof record.historyNote === "string" ? record.historyNote : null,
  };
}

export async function loadTeamView(leagueId: string, rosterId: number): Promise<TeamView | null> {
  const league = await prisma.leagueSeason.findUnique({
    where: { externalLeagueId: leagueId },
    include: {
      memberships: true,
      rosters: { orderBy: { externalRosterId: "asc" } },
      matchups: { orderBy: [{ week: "asc" }, { externalRosterId: "asc" }] },
      drafts: { include: { picks: { orderBy: { ordinal: "asc" } } } },
      transactions: { include: { assets: { orderBy: { sequence: "asc" } } }, orderBy: { createdAtSource: "asc" } },
      tradedPicks: true,
    },
  });
  if (!league) return null;
  const relatedRows = await prisma.leagueSeason.findMany({
    where: {
      OR: [{ externalLeagueId: league.previousLeagueId ?? "__none__" }, { previousLeagueId: league.externalLeagueId }],
      NOT: { externalLeagueId: league.externalLeagueId },
    },
    select: { externalLeagueId: true, season: true, name: true },
  });
  const playerIds = new Set<string>();
  for (const roster of league.rosters) {
    for (const id of [...roster.players, ...roster.starters, ...roster.reserve, ...roster.taxi]) playerIds.add(id);
  }
  for (const draft of league.drafts) {
    for (const pick of draft.picks) {
      if (pick.playerExternalId) playerIds.add(pick.playerExternalId);
    }
  }
  const players = playerIds.size
    ? await prisma.player.findMany({
        where: { sleeperId: { in: [...playerIds] } },
        select: { sleeperId: true, fullName: true, position: true, team: true },
      })
    : [];
  const source: TeamSource = {
    league: {
      externalLeagueId: league.externalLeagueId,
      name: league.name,
      season: league.season,
      status: league.status,
      sport: league.sport,
      previousLeagueId: league.previousLeagueId,
      rosterPositions: stringList(league.rosterPositions),
      scoringSettings: asRecord(league.scoringSettings),
      settings: asRecord(league.settings),
      isDemo: league.isDemo,
      lastSyncedAt: league.lastSyncedAt?.toISOString() ?? null,
      completeness: completeness(league.dataCompleteness),
    },
    memberships: league.memberships.map((member) => ({
      externalUserId: member.externalUserId,
      displayName: member.displayName,
      teamName: member.teamName,
    })),
    rosters: league.rosters.map((roster) => ({
      externalRosterId: roster.externalRosterId,
      ownerExternalUserId: roster.ownerExternalUserId,
      coOwnerExternalUserIds: roster.coOwnerExternalUserIds,
      players: roster.players,
      starters: roster.starters,
      reserve: roster.reserve,
      taxi: roster.taxi,
      settings: asRecord(roster.settings),
      incompleteReason: roster.incompleteReason,
    })),
    matchups: league.matchups.map((matchup) => ({
      externalRosterId: matchup.externalRosterId,
      week: matchup.week,
      seasonType: matchup.seasonType === "post" ? "post" : "regular",
      matchupId: matchup.matchupId,
      points: matchup.points,
      customPoints: matchup.customPoints,
      starters: matchup.starters,
      startersPoints: numberList(matchup.startersPoints),
      isPartial: matchup.isPartial,
    })),
    drafts: league.drafts.map((draft) => ({
      externalDraftId: draft.externalDraftId,
      type: draft.type,
      status: draft.status,
      season: draft.season,
      picks: draft.picks.map((pick) => ({
        ordinal: pick.ordinal,
        pickNo: pick.pickNo,
        round: pick.round,
        draftSlot: pick.draftSlot,
        rosterId: pick.rosterId,
        attributionSource: pick.attributionSource,
        playerExternalId: pick.playerExternalId,
        playerName: pick.playerName,
        position: pick.position,
        nflTeam: pick.nflTeam,
        irregularities: pick.irregularities,
      })),
    })),
    transactions: league.transactions.map((transaction) => ({
      externalTransactionId: transaction.externalTransactionId,
      type: transaction.type,
      status: transaction.status,
      executed: transaction.executed,
      week: transaction.week,
      rosterIds: transaction.rosterIds,
      assets: transaction.assets.map((asset) => ({
        kind: asset.kind,
        playerExternalId: asset.playerExternalId,
        fromRosterId: asset.fromRosterId,
        toRosterId: asset.toRosterId,
        pickSeason: asset.pickSeason,
        pickRound: asset.pickRound,
        faabAmount: asset.faabAmount,
      })),
    })),
    tradedPicks: league.tradedPicks.map((pick) => ({
      season: pick.season,
      round: pick.round,
      originalRosterId: pick.originalRosterId,
      ownerRosterId: pick.ownerRosterId,
    })),
    related: relatedRows,
    players,
  };
  return toTeamView(source, rosterId);
}
