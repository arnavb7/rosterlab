export type HistoryDecision = {
  nextLeagueId: string | null;
  notice: { level: "info"; code: string; message: string } | null;
};

export function selectNextHistoryLeague(input: {
  previousLeagueId: string | null;
  visited: readonly string[];
  followed: number;
  limit: number;
}): HistoryDecision {
  if (!input.previousLeagueId) return { nextLeagueId: null, notice: null };
  if (input.visited.includes(input.previousLeagueId)) {
    return {
      nextLeagueId: null,
      notice: {
        level: "info",
        code: "history_cycle",
        message: `Stopped at ${input.previousLeagueId} because that season is already in this import.`,
      },
    };
  }
  if (input.followed >= input.limit) {
    return {
      nextLeagueId: null,
      notice: {
        level: "info",
        code: "history_limit",
        message: `Stopped after ${input.limit} previous season${input.limit === 1 ? "" : "s"}.`,
      },
    };
  }
  return { nextLeagueId: input.previousLeagueId, notice: null };
}
