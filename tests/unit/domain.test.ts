import { describe, expect, it } from "vitest";

import { shouldFetchUpstream } from "@/domain/cache-policy";
import { normalizeDraftPicks } from "@/domain/draft-picks";
import { featureAvailability } from "@/domain/features";
import { selectNextHistoryLeague } from "@/domain/history";
import { detectLeagueFormat } from "@/domain/league-format";
import { classifyScoring, presetScoring } from "@/domain/scoring";
import { normalizeTransaction } from "@/domain/transactions";
import { planWeeks } from "@/domain/weeks";

describe("scoring presets", () => {
  it("accepts half-PPR including binary float yardage", () => {
    const settings = presetScoring("HALF_PPR");
    settings.pass_yd = 0.03999999910593033;
    const result = classifyScoring(settings);
    expect(result.preset).toBe("HALF_PPR");
    expect(result.supported).toBe(true);
  });

  it("lists divergent and unsupported keys instead of coercing a preset", () => {
    const settings = { ...presetScoring("PPR"), pass_td: 6, idp_sack: 1 };
    const result = classifyScoring(settings);
    expect(result.supported).toBe(false);
    expect(result.preset).toBe("CUSTOM");
    expect(result.divergent.map((item) => item.key)).toContain("pass_td");
    expect(result.unsupported.map((item) => item.key)).toContain("idp_sack");
  });

  it("does not treat a missing identity key as a preset", () => {
    const settings = presetScoring("STANDARD");
    delete settings.pass_td;
    const result = classifyScoring(settings);
    expect(result.preset).toBe("INCOMPLETE");
    expect(result.missing).toContain("pass_td");
  });
});

describe("week plans", () => {
  it("starts at start_week and separates the postseason without assuming 18 weeks", () => {
    const plan = planWeeks({
      status: "complete",
      season: "2018",
      settings: { start_week: 2, last_scored_leg: 16, leg: 16, playoff_week_start: 14 },
      nflState: { season: "2026", week: 7, leg: 7, seasonType: "regular" },
    });
    expect(plan.weeks.map((week) => week.week)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    expect(plan.weeks.filter((week) => week.seasonType === "post").map((week) => week.week)).toEqual([14, 15, 16]);
    expect(plan.weeks.every((week) => week.partial === false)).toBe(true);
  });

  it("marks only the current in-season week as partial", () => {
    const plan = planWeeks({
      status: "in_season",
      season: "2025",
      settings: { start_week: 1, last_scored_leg: 6, leg: 6, playoff_week_start: 15 },
      nflState: { season: "2025", week: 6, leg: 6, seasonType: "regular" },
    });
    expect(plan.weeks.find((week) => week.week === 6)?.partial).toBe(true);
    expect(plan.weeks.find((week) => week.week === 5)?.partial).toBe(false);
  });
});

describe("cache policy", () => {
  const now = new Date("2026-10-23T12:00:00Z");

  it("keeps the player directory for 24 hours even during a correction", () => {
    const fetched = new Date(now.getTime() - 23 * 60 * 60 * 1000);
    expect(shouldFetchUpstream("player_directory", fetched, now, true)).toBe(false);
    expect(shouldFetchUpstream("player_directory", new Date(now.getTime() - 25 * 60 * 60 * 1000), now, false)).toBe(true);
  });

  it("refetches completed weeks only for a correction and current weeks after 15 minutes", () => {
    const recent = new Date(now.getTime() - 5 * 60 * 1000);
    expect(shouldFetchUpstream("completed_week", recent, now, false)).toBe(false);
    expect(shouldFetchUpstream("completed_week", recent, now, true)).toBe(true);
    expect(shouldFetchUpstream("current_week", recent, now, true)).toBe(false);
    expect(shouldFetchUpstream("current_week", new Date(now.getTime() - 16 * 60 * 1000), now, false)).toBe(true);
  });
});

describe("draft attribution", () => {
  it("does not copy the draft slot into the roster id", () => {
    const [pick] = normalizeDraftPicks(
      [{ player_id: "p1", draft_slot: 1, pick_no: 1, round: 1, roster_id: 10, metadata: { first_name: "Ada", last_name: "West" } }],
      { "1": 3 },
    );
    expect(pick?.rosterId).toBe(10);
    expect(pick?.attributionSource).toBe("pick.roster_id");
  });

  it("uses slot_to_roster_id only when the pick has no roster id", () => {
    const [pick] = normalizeDraftPicks(
      [{ player_id: "p1", draft_slot: 2, pick_no: 2, round: 1 }],
      { "2": 7 },
    );
    expect(pick?.rosterId).toBe(7);
    expect(pick?.attributionSource).toBe("slot_to_roster_id");
  });

  it("keeps duplicate pick numbers and marks them", () => {
    const picks = normalizeDraftPicks(
      [
        { player_id: "a", pick_no: 1, roster_id: 1 },
        { player_id: "b", pick_no: 1, roster_id: 2 },
      ],
      null,
    );
    expect(picks).toHaveLength(2);
    expect(picks.every((pick) => pick.irregularities.includes("duplicate_pick_no"))).toBe(true);
  });
});

describe("history and transactions", () => {
  it("stops on a cycle and on the configured limit", () => {
    expect(
      selectNextHistoryLeague({ previousLeagueId: "a", visited: ["a"], followed: 0, limit: 3 }).notice?.code,
    ).toBe("history_cycle");
    expect(
      selectNextHistoryLeague({ previousLeagueId: "b", visited: ["a"], followed: 3, limit: 3 }).notice?.code,
    ).toBe("history_limit");
  });

  it("counts only completed transactions as executed", () => {
    const completed = normalizeTransaction(
      { transaction_id: "1", status: "complete", type: "waiver", adds: { p: 1 }, drops: null },
      2,
    );
    const failed = normalizeTransaction(
      { transaction_id: "2", status: "failed", type: "waiver", adds: { q: 1 } },
      2,
    );
    expect(completed?.executed).toBe(true);
    expect(failed?.executed).toBe(false);
    expect(failed?.assets).toHaveLength(1);
  });
});

describe("feature availability", () => {
  it("does not enable waivers or trades without those providers", () => {
    const format = detectLeagueFormat({
      sport: "nfl",
      settings: { type: 0, max_keepers: 0 },
      rosterPositions: ["QB", "RB", "WR", "FLEX", "BN"],
      scoringSettings: presetScoring("PPR"),
      draftTypes: ["snake"],
      draftsKnown: true,
    });
    const features = featureAvailability(format);
    expect(features.find((feature) => feature.id === "waivers")?.available).toBe(false);
    expect(features.find((feature) => feature.id === "trades")?.available).toBe(false);
    expect(features.find((feature) => feature.id === "adp")?.available).toBe(false);
    expect(format.scoring.supported).toBe(true);
  });

  it("disables dynasty valuation and auction strategy from the detected format", () => {
    const format = detectLeagueFormat({
      sport: "nfl",
      settings: { type: 2, max_keepers: 3 },
      rosterPositions: ["QB", "SUPER_FLEX", "BN", "TAXI"],
      scoringSettings: { ...presetScoring("HALF_PPR"), idp_sack: 1 },
      draftTypes: ["auction"],
    });
    expect(format.typeLabel).toBe("dynasty");
    expect(format.keeperRulesConfigured).toBe(true);
    expect(format.disabledAnalyses.join(" ")).toMatch(/Dynasty/);
    expect(format.disabledAnalyses.join(" ")).toMatch(/Auction/);
    expect(format.disabledAnalyses.join(" ")).toMatch(/IDP/);
    expect(format.scoring.supported).toBe(false);
  });
});
