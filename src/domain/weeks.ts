export type SeasonPhase = "pre_draft" | "drafting" | "in_season" | "complete" | "unknown";

export type WeekPlan = {
  week: number;
  seasonType: "regular" | "post";
  partial: boolean;
};

export type NflStateSnapshot = {
  season: string;
  week: number;
  leg: number;
  seasonType: string;
};

export type WeekPlanResult = {
  weeks: WeekPlan[];
  notices: { level: "info" | "warning"; code: string; message: string }[];
};

const MAX_WEEK = 30;

function integerSetting(settings: Record<string, unknown>, key: string): number | null {
  const value = settings[key];
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

export function seasonPhase(status: string): SeasonPhase {
  if (status === "pre_draft" || status === "drafting" || status === "in_season" || status === "complete") {
    return status;
  }
  return "unknown";
}

export function planWeeks(input: {
  status: string;
  season: string;
  settings: Record<string, unknown>;
  nflState: NflStateSnapshot | null;
}): WeekPlanResult {
  const notices: WeekPlanResult["notices"] = [];
  const startSetting = integerSetting(input.settings, "start_week");
  const start = startSetting ?? 1;
  if (startSetting === null) {
    notices.push({
      level: "info",
      code: "start_week_default",
      message: "start_week was not set. Week 1 is used as the first week.",
    });
  }

  const lastScored = integerSetting(input.settings, "last_scored_leg");
  const leg = integerSetting(input.settings, "leg");
  let last = Math.max(lastScored ?? 0, leg ?? 0);
  const phase = seasonPhase(input.status);
  if (last === 0 && phase === "in_season" && input.nflState && input.nflState.season === input.season) {
    last = input.nflState.leg;
    notices.push({
      level: "info",
      code: "week_from_nfl_state",
      message: "The league did not report a scored leg. The current NFL leg is used.",
    });
  }
  if (last === 0) {
    notices.push({
      level: "info",
      code: "no_scored_weeks",
      message: "Sleeper did not report any scored weeks for this season.",
    });
    return { weeks: [], notices };
  }
  if (last > MAX_WEEK) {
    notices.push({
      level: "warning",
      code: "week_cap",
      message: `Reported week ${last} is above ${MAX_WEEK}. Import stops at week ${MAX_WEEK}.`,
    });
    last = MAX_WEEK;
  }
  if (start > last) {
    notices.push({
      level: "warning",
      code: "empty_week_range",
      message: `start_week ${start} is after the last scored week ${last}.`,
    });
    return { weeks: [], notices };
  }

  const playoffStart = integerSetting(input.settings, "playoff_week_start");
  if (playoffStart === null) {
    notices.push({
      level: "info",
      code: "playoffs_unmarked",
      message: "playoff_week_start was not set, so every imported week is labeled regular season.",
    });
  }

  const weeks: WeekPlan[] = [];
  for (let week = start; week <= last; week += 1) {
    const postseason = playoffStart !== null && week >= playoffStart;
    const partial =
      phase === "in_season" &&
      input.nflState !== null &&
      input.nflState.season === input.season &&
      week === last &&
      (input.nflState.seasonType === "regular" || input.nflState.seasonType === "post");
    weeks.push({
      week,
      seasonType: postseason ? "post" : "regular",
      partial,
    });
  }
  return { weeks, notices };
}
