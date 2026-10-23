import { detectLeagueFormat, formatSummary } from "@/domain/league-format";
import type { DataCompleteness } from "@/domain/normalized";
import { featureAvailability } from "@/domain/features";
import { seasonPhase } from "@/domain/weeks";

export const playerFieldsForView = ["sleeperId", "fullName", "position", "team"] as const;

export type ViewPlayer = {
  sleeperId: string;
  fullName: string | null;
  position: string | null;
  team: string | null;
};

export type TeamSource = {
  league: {
    externalLeagueId: string;
    name: string;
    season: string;
    status: string;
    sport: string;
    previousLeagueId: string | null;
    rosterPositions: string[];
    scoringSettings: Record<string, unknown>;
    settings: Record<string, unknown>;
    isDemo: boolean;
    lastSyncedAt: string | null;
    completeness: DataCompleteness | null;
  };
  memberships: { externalUserId: string; displayName: string | null; teamName: string | null }[];
  rosters: {
    externalRosterId: number;
    ownerExternalUserId: string | null;
    coOwnerExternalUserIds: string[];
    players: string[];
    starters: string[];
    reserve: string[];
    taxi: string[];
    settings: Record<string, unknown>;
    incompleteReason: string | null;
  }[];
  matchups: {
    externalRosterId: number;
    week: number;
    seasonType: "regular" | "post";
    matchupId: number | null;
    points: number | null;
    customPoints: number | null;
    starters: string[];
    startersPoints: (number | null)[] | null;
    isPartial: boolean;
  }[];
  drafts: {
    externalDraftId: string;
    type: string;
    status: string;
    season: string;
    picks: {
      ordinal: number;
      pickNo: number | null;
      round: number | null;
      draftSlot: number | null;
      rosterId: number | null;
      attributionSource: string;
      playerExternalId: string | null;
      playerName: string | null;
      position: string | null;
      nflTeam: string | null;
      irregularities: string[];
    }[];
  }[];
  transactions: {
    externalTransactionId: string;
    type: string;
    status: string;
    executed: boolean;
    week: number | null;
    rosterIds: number[];
    assets: {
      kind: string;
      playerExternalId: string | null;
      fromRosterId: number | null;
      toRosterId: number | null;
      pickSeason: string | null;
      pickRound: number | null;
      faabAmount: number | null;
    }[];
  }[];
  tradedPicks: { season: string; round: number; originalRosterId: number; ownerRosterId: number }[];
  related: {
    externalLeagueId: string;
    season: string;
    name: string;
  }[];
  players: ViewPlayer[];
};

export type PlayerLine = {
  playerId: string;
  name: string;
  position: string | null;
  nflTeam: string | null;
  unresolved: boolean;
  points: number | null;
};

export type TeamView = {
  demo: boolean;
  leagueName: string;
  season: string;
  status: string;
  phase: string;
  leagueId: string;
  rosterId: number;
  rosterFound: boolean;
  ownerName: string;
  teamName: string | null;
  coOwners: string[];
  record: string | null;
  seasonPoints: string | null;
  incompleteReason: string | null;
  formatLines: string[];
  scoringDetail: string[];
  disabledAnalyses: string[];
  unavailableFeatures: { label: string; reason: string }[];
  lastSyncedAt: string | null;
  notices: { level: "info" | "warning"; message: string }[];
  groups: { label: string; players: PlayerLine[] }[];
  otherRosters: { rosterId: number; name: string }[];
  matchups: {
    week: number;
    seasonType: "regular" | "post";
    partial: boolean;
    points: number | null;
    customPoints: number | null;
    opponent: { rosterId: number; name: string; points: number | null } | null;
    starters: PlayerLine[];
    pointsAligned: boolean;
  }[];
  drafts: {
    externalId: string;
    type: string;
    status: string;
    season: string;
    slots: number[];
    rounds: number[];
    picks: {
      ordinal: number;
      pickNo: number | null;
      round: number | null;
      draftSlot: number | null;
      rosterId: number | null;
      attributionSource: string;
      name: string;
      position: string | null;
      nflTeam: string | null;
      unresolved: boolean;
      irregularities: string[];
      selectedTeam: boolean;
    }[];
  }[];
  transactions: {
    externalId: string;
    week: number | null;
    type: string;
    status: string;
    executed: boolean;
    summary: string;
    selectedTeam: boolean;
  }[];
  tradedPicks: { season: string; round: number; originalRosterId: number; ownerRosterId: number }[];
  related: { externalLeagueId: string; season: string; name: string }[];
};

function directory(players: ViewPlayer[]): Map<string, ViewPlayer> {
  return new Map(players.map((player) => [player.sleeperId, player]));
}

function line(playerId: string, players: Map<string, ViewPlayer>, points: number | null = null): PlayerLine {
  if (playerId === "0") {
    return { playerId, name: "Empty slot", position: null, nflTeam: null, unresolved: false, points };
  }
  const known = players.get(playerId);
  return {
    playerId,
    name: known?.fullName || `Unresolved player ${playerId}`,
    position: known?.position ?? null,
    nflTeam: known?.team ?? null,
    unresolved: !known?.fullName,
    points,
  };
}

function memberName(
  memberships: TeamSource["memberships"],
  userId: string | null,
): { owner: string; team: string | null } {
  if (!userId) return { owner: "No owner recorded", team: null };
  const member = memberships.find((item) => item.externalUserId === userId);
  return {
    owner: member?.displayName || userId,
    team: member?.teamName ?? null,
  };
}

function recordLabel(settings: Record<string, unknown>): string | null {
  if (typeof settings.wins !== "number" || typeof settings.losses !== "number") return null;
  const ties = typeof settings.ties === "number" ? settings.ties : 0;
  return ties > 0 ? `${settings.wins}-${settings.losses}-${ties}` : `${settings.wins}-${settings.losses}`;
}

function seasonPoints(settings: Record<string, unknown>): string | null {
  if (typeof settings.fpts !== "number") return null;
  const decimal = typeof settings.fpts_decimal === "number" ? settings.fpts_decimal : 0;
  return (settings.fpts + decimal / 100).toFixed(2);
}

function rosterLabel(source: TeamSource, rosterId: number): string {
  const roster = source.rosters.find((item) => item.externalRosterId === rosterId);
  if (!roster) return `Roster ${rosterId}`;
  const name = memberName(source.memberships, roster.ownerExternalUserId);
  return name.team || name.owner;
}

export function toTeamView(source: TeamSource, rosterId: number): TeamView {
  const players = directory(source.players);
  const format = detectLeagueFormat({
    sport: source.league.sport,
    settings: source.league.settings,
    rosterPositions: source.league.rosterPositions,
    scoringSettings: source.league.scoringSettings,
    draftTypes: source.drafts.map((draft) => draft.type),
    draftsKnown: true,
  });
  const roster = source.rosters.find((item) => item.externalRosterId === rosterId) ?? null;
  const identity = memberName(source.memberships, roster?.ownerExternalUserId ?? null);
  const coOwners = (roster?.coOwnerExternalUserIds ?? []).map(
    (userId) => memberName(source.memberships, userId).owner,
  );
  const starterSet = new Set(roster?.starters ?? []);
  const reserveSet = new Set(roster?.reserve ?? []);
  const taxiSet = new Set(roster?.taxi ?? []);
  const bench = (roster?.players ?? []).filter((id) => !starterSet.has(id) && !reserveSet.has(id) && !taxiSet.has(id));
  const groups = [
    { label: "Starters", players: (roster?.starters ?? []).map((id) => line(id, players)) },
    { label: "Bench", players: bench.map((id) => line(id, players)) },
    { label: "Reserve", players: (roster?.reserve ?? []).map((id) => line(id, players)) },
    { label: "Taxi", players: (roster?.taxi ?? []).map((id) => line(id, players)) },
  ].filter((group) => group.players.length > 0);

  const selectedMatchups = source.matchups
    .filter((matchup) => matchup.externalRosterId === rosterId)
    .sort((left, right) => left.week - right.week);
  const matchups = selectedMatchups.map((matchup) => {
    const opponent = source.matchups.find(
      (other) =>
        other.week === matchup.week &&
        other.matchupId !== null &&
        other.matchupId === matchup.matchupId &&
        other.externalRosterId !== rosterId,
    );
    const aligned =
      Array.isArray(matchup.startersPoints) && matchup.startersPoints.length === matchup.starters.length;
    return {
      week: matchup.week,
      seasonType: matchup.seasonType,
      partial: matchup.isPartial,
      points: matchup.points,
      customPoints: matchup.customPoints,
      opponent: opponent
        ? {
            rosterId: opponent.externalRosterId,
            name: rosterLabel(source, opponent.externalRosterId),
            points: opponent.points,
          }
        : null,
      starters: matchup.starters.map((id, index) =>
        line(id, players, aligned ? (matchup.startersPoints?.[index] ?? null) : null),
      ),
      pointsAligned: aligned,
    };
  });

  const scoringDetail: string[] = [];
  if (format.scoring.supported) {
    scoringDetail.push(`${format.scoring.preset} matches the supported preset.`);
  } else if (format.scoring.preset === "INCOMPLETE") {
    scoringDetail.push(`Scoring settings are incomplete. Missing: ${format.scoring.missing.join(", ") || "required keys"}.`);
  } else {
    scoringDetail.push("Scoring does not match a supported preset.");
    if (format.scoring.closestPreset) {
      scoringDetail.push(`Receiving value matches ${format.scoring.closestPreset}, and other keys differ.`);
    }
    if (format.scoring.divergent.length > 0) {
      scoringDetail.push(
        `Divergent keys: ${format.scoring.divergent.map((item) => item.key).join(", ")}.`,
      );
    }
    if (format.scoring.unsupported.length > 0) {
      scoringDetail.push(
        `Unsupported keys: ${format.scoring.unsupported.map((item) => item.key).join(", ")}.`,
      );
    }
  }

  const notices: TeamView["notices"] = [];
  const completeness = source.league.completeness;
  if (completeness?.emptyMatchupWeeks.length) {
    notices.push({
      level: "warning",
      message: `Weeks with no matchup payload: ${completeness.emptyMatchupWeeks.join(", ")}.`,
    });
  }
  const unresolvedIds = (completeness?.unresolvedPlayerIds ?? []).filter((id) => id !== "0");
  if (unresolvedIds.length) {
    notices.push({
      level: "info",
      message: `${unresolvedIds.length} player id${unresolvedIds.length === 1 ? " is" : "s are"} missing from the player directory.`,
    });
  }
  if (completeness?.historyNote) notices.push({ level: "info", message: completeness.historyNote });
  if (!roster) {
    notices.push({ level: "warning", message: `Roster ${rosterId} is not in the imported league.` });
  }

  return {
    demo: source.league.isDemo,
    leagueName: source.league.name,
    season: source.league.season,
    status: source.league.status,
    phase: seasonPhase(source.league.status),
    leagueId: source.league.externalLeagueId,
    rosterId,
    rosterFound: roster !== null,
    ownerName: identity.owner,
    teamName: identity.team,
    coOwners,
    record: roster ? recordLabel(roster.settings) : null,
    seasonPoints: roster ? seasonPoints(roster.settings) : null,
    incompleteReason: roster?.incompleteReason ?? null,
    formatLines: formatSummary(format),
    scoringDetail,
    disabledAnalyses: format.disabledAnalyses,
    unavailableFeatures: featureAvailability(format)
      .filter((feature) => !feature.available)
      .map((feature) => ({ label: feature.label, reason: feature.reason })),
    lastSyncedAt: source.league.lastSyncedAt,
    notices,
    groups,
    otherRosters: source.rosters
      .filter((item) => item.externalRosterId !== rosterId)
      .map((item) => ({ rosterId: item.externalRosterId, name: rosterLabel(source, item.externalRosterId) })),
    matchups,
    drafts: source.drafts.map((draft) => ({
      externalId: draft.externalDraftId,
      type: draft.type,
      status: draft.status,
      season: draft.season,
      slots: [...new Set(draft.picks.map((pick) => pick.draftSlot).filter((slot): slot is number => slot !== null))].sort(
        (left, right) => left - right,
      ),
      rounds: [...new Set(draft.picks.map((pick) => pick.round).filter((round): round is number => round !== null))].sort(
        (left, right) => left - right,
      ),
      picks: draft.picks.map((pick) => {
        const known = pick.playerExternalId ? players.get(pick.playerExternalId) : undefined;
        const unresolved = Boolean(pick.playerExternalId) && !known?.fullName && !pick.playerName;
        return {
          ordinal: pick.ordinal,
          pickNo: pick.pickNo,
          round: pick.round,
          draftSlot: pick.draftSlot,
          rosterId: pick.rosterId,
          attributionSource: pick.attributionSource,
          name: known?.fullName || pick.playerName || (pick.playerExternalId ? `Unresolved player ${pick.playerExternalId}` : "No player recorded"),
          position: known?.position ?? pick.position,
          nflTeam: known?.team ?? pick.nflTeam,
          unresolved,
          irregularities: pick.irregularities,
          selectedTeam: pick.rosterId === rosterId,
        };
      }),
    })),
    transactions: source.transactions.map((transaction) => ({
      externalId: transaction.externalTransactionId,
      week: transaction.week,
      type: transaction.type,
      status: transaction.status,
      executed: transaction.executed,
      selectedTeam: transaction.rosterIds.includes(rosterId),
      summary: summarizeTransaction(transaction, players),
    })),
    tradedPicks: source.tradedPicks,
    related: source.related,
  };
}

function summarizeTransaction(
  transaction: TeamSource["transactions"][number],
  players: Map<string, ViewPlayer>,
): string {
  if (transaction.assets.length === 0) return "No assets recorded";
  return transaction.assets
    .map((asset) => {
      if (asset.kind === "player_add" && asset.playerExternalId) {
        const name = players.get(asset.playerExternalId)?.fullName || asset.playerExternalId;
        return `Added ${name} to roster ${asset.toRosterId ?? "?"}`;
      }
      if (asset.kind === "player_drop" && asset.playerExternalId) {
        const name = players.get(asset.playerExternalId)?.fullName || asset.playerExternalId;
        return `Dropped ${name} from roster ${asset.fromRosterId ?? "?"}`;
      }
      if (asset.kind === "draft_pick") {
        return `Pick ${asset.pickSeason ?? "?"} round ${asset.pickRound ?? "?"}`;
      }
      if (asset.kind === "faab") return `FAAB ${asset.faabAmount ?? "?"}`;
      return asset.kind;
    })
    .join(" · ");
}
