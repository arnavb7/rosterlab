import type { LeagueFormat } from "@/domain/league-format";

export type FeatureStatus = {
  id: string;
  label: string;
  available: boolean;
  reason: string;
};

export type ProviderCapabilityRecord = {
  id: string;
  displayName: string;
  availableMetrics: string[];
  supportedSeasons: string;
  latestDataTimestamp: string | null;
  updateFrequency: string;
  licenseNotes: string;
  operationalStatus: "available" | "not_configured";
  limitations: string[];
};

export const providerRegistry: ProviderCapabilityRecord[] = [
  {
    id: "sleeper",
    displayName: "Sleeper",
    availableMetrics: [
      "leagues",
      "rosters",
      "matchups",
      "transactions",
      "drafts",
      "traded_picks",
      "player_directory",
      "nfl_state",
    ],
    supportedSeasons: "Seasons Sleeper returns for NFL, observed from 2017 onward in public examples.",
    latestDataTimestamp: null,
    updateFrequency: "League metadata and the current week: 15 minutes. Player directory: 24 hours. Completed weeks: kept until a correction import.",
    licenseNotes:
      "Official read-only API. Sleeper documents free non-commercial use and asks commercial users to contact api@sleeper.app. No API token is used.",
    operationalStatus: "available",
    limitations: [
      "Current rosters are not historical snapshots.",
      "search_rank is not historical ADP.",
      "Trending adds and drops are not used as local availability or player quality.",
      "The public docs do not define settings.type. Raw type codes are kept.",
    ],
  },
  {
    id: "nflverse",
    displayName: "nflverse",
    availableMetrics: [],
    supportedSeasons: "Not ingested.",
    latestDataTimestamp: null,
    updateFrequency: "Not configured.",
    licenseNotes:
      "Public nflverse-data release files were inspected on 23 October 2026. No adapter reads them in this milestone.",
    operationalStatus: "not_configured",
    limitations: [
      "Weekly player stats exist as stats_player/stats_player_week_{season}.csv.gz and use a GSIS player id.",
      "players.csv does not contain a Sleeper id, so those stats are not joined.",
      "snap_counts_{season}.csv has offense_pct, but route participation is not in that file.",
      "target_share is present on the weekly stats file and is unused until its denominator is confirmed.",
    ],
  },
  {
    id: "csv_import",
    displayName: "CSV import",
    availableMetrics: [],
    supportedSeasons: "Not ingested.",
    latestDataTimestamp: null,
    updateFrequency: "Not configured.",
    licenseNotes: "Historical ADP, rankings, and projections require a timestamped file from the user. That importer is not built yet.",
    operationalStatus: "not_configured",
    limitations: ["No projection or ranking snapshots are stored."],
  },
];

export function featureAvailability(format: LeagueFormat): FeatureStatus[] {
  const supplemental = providerRegistry.find((provider) => provider.id === "nflverse");
  const projections = providerRegistry.find((provider) => provider.id === "csv_import");
  const usageReady = supplemental?.operationalStatus === "available";
  const projectionsReady = projections?.operationalStatus === "available";

  return [
    {
      id: "roster",
      label: "Roster",
      available: true,
      reason: "Imported from the current Sleeper roster endpoint.",
    },
    {
      id: "matchups",
      label: "Matchups",
      available: true,
      reason: "Imported from Sleeper weekly matchups. The current week is marked partial while the season is in progress.",
    },
    {
      id: "draft_board",
      label: "Draft board",
      available: true,
      reason: "Imported from Sleeper drafts and picks. This view does not label strategy.",
    },
    {
      id: "manager_report",
      label: "Manager report",
      available: false,
      reason: "Coaching rules are not implemented yet.",
    },
    {
      id: "draft_strategy",
      label: "Draft strategy",
      available: false,
      reason: format.snakeDraftPresent && format.sportSupported && format.typeLabel === "redraft" && !format.auction && !format.keeperRulesConfigured
        ? "Positional construction can be shown from picks. Strategy labels are not implemented yet."
        : "Strategy labels stay off for this league format, and the strategy module is not implemented yet.",
    },
    {
      id: "adp",
      label: "ADP comparison",
      available: false,
      reason: "No timestamped ranking snapshot is stored. Sleeper search_rank is not used as ADP.",
    },
    {
      id: "waivers",
      label: "Waiver usage",
      available: usageReady,
      reason: usageReady
        ? "Usage metrics are available."
        : "Weekly usage data is not connected. Available players are not ranked.",
    },
    {
      id: "trades",
      label: "Trade values",
      available: projectionsReady && format.scoring.supported && format.typeLabel !== "dynasty",
      reason: !projectionsReady
        ? "No timestamped projection source is connected. Trade picks are shown as history only."
        : "Projections are not valued for this league format.",
    },
  ];
}
