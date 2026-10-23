import { classifyScoring, type ScoringClassification } from "@/domain/scoring";

const IDP_POSITIONS = new Set(["DL", "LB", "DB", "IDP", "DE", "DT", "CB", "S", "EDGE", "DP"]);
const BENCH_POSITIONS = new Set(["BN", "BE"]);
const RESERVE_POSITIONS = new Set(["IR", "RES", "RESERVE"]);
const TAXI_POSITIONS = new Set(["TAXI"]);

export type LeagueTypeLabel = "redraft" | "keeper" | "dynasty" | "unknown";

export type LeagueFormat = {
  sport: string;
  sportSupported: boolean;
  typeCode: number | null;
  typeLabel: LeagueTypeLabel;
  keeperRulesConfigured: boolean;
  maxKeepers: number | null;
  bestBall: boolean | null;
  idp: boolean;
  draftTypes: string[];
  auction: boolean;
  snakeDraftPresent: boolean;
  superflex: boolean;
  taxi: boolean;
  starterSlots: string[];
  benchSlots: number;
  reserveSlots: number;
  taxiSlots: number;
  scoring: ScoringClassification;
  disabledAnalyses: string[];
};

function integerSetting(settings: Record<string, unknown>, key: string): number | null {
  const value = settings[key];
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function typeLabel(typeCode: number | null): LeagueTypeLabel {
  if (typeCode === 0) return "redraft";
  if (typeCode === 1) return "keeper";
  if (typeCode === 2) return "dynasty";
  return "unknown";
}

export function detectLeagueFormat(input: {
  sport: string;
  settings: Record<string, unknown>;
  rosterPositions: string[];
  scoringSettings: Record<string, unknown>;
  draftTypes: string[];
  draftsKnown?: boolean;
}): LeagueFormat {
  const scoring = classifyScoring(input.scoringSettings);
  const typeCode = integerSetting(input.settings, "type");
  const label = typeLabel(typeCode);
  const maxKeepers = integerSetting(input.settings, "max_keepers");
  const bestBallValue = input.settings.best_ball;
  const bestBall = typeof bestBallValue === "number" ? bestBallValue === 1 : null;
  const positions = input.rosterPositions;
  const idpFromPositions = positions.some((position) => IDP_POSITIONS.has(position));
  const idpFromScoring = Object.entries(input.scoringSettings).some(([key, value]) => {
    return key.startsWith("idp_") && typeof value === "number" && Math.abs(value) >= 0.001;
  });
  const draftTypes = input.draftTypes.map((draftType) => draftType.toLowerCase());
  const format: LeagueFormat = {
    sport: input.sport,
    sportSupported: input.sport.toLowerCase() === "nfl",
    typeCode,
    typeLabel: label,
    keeperRulesConfigured: label === "keeper" || (maxKeepers ?? 0) > 0,
    maxKeepers,
    bestBall,
    idp: idpFromPositions || idpFromScoring,
    draftTypes,
    auction: draftTypes.includes("auction"),
    snakeDraftPresent: draftTypes.includes("snake"),
    superflex: positions.includes("SUPER_FLEX"),
    taxi: positions.some((position) => TAXI_POSITIONS.has(position)) || (integerSetting(input.settings, "taxi_slots") ?? 0) > 0,
    starterSlots: positions.filter(
      (position) => !BENCH_POSITIONS.has(position) && !RESERVE_POSITIONS.has(position) && !TAXI_POSITIONS.has(position),
    ),
    benchSlots: positions.filter((position) => BENCH_POSITIONS.has(position)).length,
    reserveSlots: positions.filter((position) => RESERVE_POSITIONS.has(position)).length,
    taxiSlots: positions.filter((position) => TAXI_POSITIONS.has(position)).length,
    scoring,
    disabledAnalyses: [],
  };
  format.disabledAnalyses = disabledAnalyses(format);
  return format;
}

function disabledAnalyses(format: LeagueFormat): string[] {
  const disabled: string[] = [];
  if (!format.sportSupported) disabled.push("Football analysis is disabled because this league is not NFL.");
  if (!format.scoring.supported) {
    disabled.push("Point-based analysis is disabled until every scoring key matches a supported preset.");
  }
  if (format.idp) disabled.push("IDP lineup and scoring analysis is not supported.");
  if (format.auction) disabled.push("Auction draft strategy is not supported.");
  if (format.keeperRulesConfigured) disabled.push("Keeper opportunity-cost analysis is not supported.");
  if (format.typeLabel === "dynasty") disabled.push("Dynasty player and pick valuation is not supported.");
  if (!format.snakeDraftPresent && format.draftTypes.length > 0) {
    disabled.push("Snake-draft strategy labels are not applied.");
  }
  if (format.bestBall) disabled.push("Lineup-decision analysis is not applied to a best-ball league.");
  if (format.typeLabel === "unknown") {
    disabled.push("League type is unrecognized, so redraft assumptions are not applied.");
  }
  return disabled;
}

export function formatSummary(format: LeagueFormat): string[] {
  const lines = [
    format.sportSupported ? "NFL" : `Sport: ${format.sport || "unknown"}`,
    `Type code ${format.typeCode === null ? "not set" : format.typeCode} (${format.typeLabel})`,
    format.keeperRulesConfigured
      ? `Keeper rules configured${format.maxKeepers === null ? "" : ` (max_keepers ${format.maxKeepers})`}`
      : "No keeper rules indicated",
    format.scoring.supported
      ? `${format.scoring.preset} scoring preset`
      : `Scoring ${format.scoring.preset.toLowerCase()}`,
    format.draftTypes.length > 0 ? `Draft: ${format.draftTypes.join(", ")}` : "No draft type imported",
    `Starters: ${format.starterSlots.join(", ") || "none listed"}`,
    `${format.benchSlots} bench, ${format.reserveSlots} reserve, ${format.taxiSlots} taxi`,
  ];
  if (format.superflex) lines.push("Superflex slot present");
  if (format.bestBall === null) lines.push("best_ball was not present on the league settings");
  else if (format.bestBall) lines.push("Best ball");
  return lines;
}
