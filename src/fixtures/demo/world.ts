import { presetScoring } from "@/domain/scoring";

export const DEMO_CURRENT_LEAGUE_ID = "demo-northwind";
export const DEMO_PREVIOUS_LEAGUE_ID = "demo-northwind-2024";
export const DEMO_ROSTER_ID = 1;

type PlayerSeed = {
  id: string;
  first: string;
  last: string;
  position: string;
  team: string;
  searchRank?: number;
};

const PLAYERS: PlayerSeed[] = [
  ["demo-p-r1-qb", "Adrian", "Cole", "QB", "HBR", 4242],
  ["demo-p-r1-rb", "Bea", "Morin", "RB", "HBR"],
  ["demo-p-r1-wr", "Chris", "Adeyemi", "WR", "HBR"],
  ["demo-p-r1-te", "Dana", "Voss", "TE", "HBR"],
  ["demo-p-r1-flex", "Eli", "Park", "WR", "HBR"],
  ["demo-p-trade-away", "Farah", "Nguyen", "RB", "PPR"],
  ["demo-p-r2-qb", "Gabe", "Ito", "QB", "PPR"],
  ["demo-p-r2-rb", "Hana", "Brooks", "RB", "PPR"],
  ["demo-p-r2-wr", "Ivan", "Sol", "WR", "PPR"],
  ["demo-p-r2-te", "June", "Keller", "TE", "PPR"],
  ["demo-p-r2-flex", "Kai", "Mensah", "WR", "PPR"],
  ["demo-p-trade-in", "Lila", "Ortiz", "RB", "HBR"],
  ["demo-p-r3-qb", "Moss", "Adler", "QB", "LTD"],
  ["demo-p-r3-rb", "Nia", "Shah", "RB", "LTD"],
  ["demo-p-r3-wr", "Omar", "Blake", "WR", "LTD"],
  ["demo-p-r3-te", "Priya", "Dent", "TE", "LTD"],
  ["demo-p-r3-flex", "Quin", "Holt", "WR", "LTD"],
  ["demo-p-r3-bn", "Ruth", "Pena", "RB", "LTD"],
  ["demo-p-waiver-add", "Seth", "Okada", "WR", "LTD"],
  ["demo-p-r4-qb", "Tara", "Singh", "QB", "BELL"],
  ["demo-p-r4-rb", "Uma", "Reed", "RB", "BELL"],
  ["demo-p-r4-wr", "Vic", "Lang", "WR", "BELL"],
  ["demo-p-r4-te", "Wes", "Cho", "TE", "BELL"],
  ["demo-p-r4-flex", "Xia", "Berg", "WR", "BELL"],
  ["demo-p-r4-bn", "Yuri", "Nash", "RB", "BELL"],
  ["demo-p-failed-add", "Zed", "Marlow", "WR", "HBR"],
].map(([id, first, last, position, team, searchRank]) => ({
  id: String(id),
  first: String(first),
  last: String(last),
  position: String(position),
  team: String(team),
  searchRank: typeof searchRank === "number" ? searchRank : undefined,
}));

const USERS = [
  { user_id: "u_rowan", display_name: "Rowan Vale", is_owner: true, metadata: { team_name: "Harbor Lights" } },
  { user_id: "u_quinn", display_name: "Quinn Ade", is_owner: false, metadata: { team_name: "Paper Boats" } },
  { user_id: "u_mila", display_name: "Mila Cho", is_owner: false, metadata: { team_name: "Low Tide" } },
  { user_id: "u_samir", display_name: "Samir Holt", is_owner: false, metadata: { team_name: "Second Bell" } },
];

const SLOT_TO_ROSTER: Record<string, number> = { "1": 3, "2": 1, "3": 4, "4": 2 };

const DRAFTED: Record<number, string[]> = {
  1: ["demo-p-r1-qb", "demo-p-r1-rb", "demo-p-r1-wr", "demo-p-r1-te", "demo-p-r1-flex", "demo-p-trade-away"],
  2: ["demo-p-r2-qb", "demo-p-r2-rb", "demo-p-r2-wr", "demo-p-r2-te", "demo-p-r2-flex", "demo-p-trade-in"],
  3: ["demo-p-r3-qb", "demo-p-r3-rb", "demo-p-r3-wr", "demo-p-r3-te", "demo-p-r3-flex", "demo-p-r3-bn"],
  4: ["demo-p-r4-qb", "demo-p-r4-rb", "demo-p-r4-wr", "demo-p-r4-te", "demo-p-r4-flex", "demo-p-r4-bn"],
};

function snakeSlots(round: number): number[] {
  const slots = [1, 2, 3, 4];
  return round % 2 === 1 ? slots : [...slots].reverse();
}

function playerRecord(seed: PlayerSeed) {
  return {
    player_id: seed.id,
    first_name: seed.first,
    last_name: seed.last,
    full_name: `${seed.first} ${seed.last}`,
    position: seed.position,
    fantasy_positions: [seed.position],
    team: seed.team,
    status: "Active",
    injury_status: null,
    search_rank: seed.searchRank ?? null,
  };
}

function buildMainDraft() {
  const queues = new Map<number, string[]>(Object.entries(DRAFTED).map(([rosterId, ids]) => [Number(rosterId), [...ids]]));
  const picks = [];
  let pickNo = 1;
  for (let round = 1; round <= 6; round += 1) {
    for (const slot of snakeSlots(round)) {
      const rosterId = SLOT_TO_ROSTER[String(slot)];
      const playerId = queues.get(rosterId)?.shift();
      const seed = PLAYERS.find((player) => player.id === playerId);
      const pick: Record<string, unknown> = {
        player_id: playerId,
        picked_by: rosterId === 1 ? "u_rowan" : rosterId === 2 ? "u_quinn" : rosterId === 3 ? "u_mila" : "u_samir",
        round,
        draft_slot: slot,
        pick_no: pickNo,
        is_keeper: null,
        metadata: seed
          ? { first_name: seed.first, last_name: seed.last, position: seed.position, team: seed.team }
          : {},
      };
      if (pickNo !== 1) pick.roster_id = rosterId;
      picks.push(pick);
      pickNo += 1;
    }
  }
  return picks;
}

function matchup(leagueId: string, week: number, rosterId: number, matchupId: number, playerIds: string[], starters: string[]) {
  return {
    roster_id: rosterId,
    matchup_id: matchupId,
    points: 80 + rosterId * 3 + week,
    custom_points: null,
    players: playerIds,
    starters,
    starters_points: starters.map((_, index) => 8 + index + week),
    players_points: Object.fromEntries(playerIds.map((id, index) => [id, index < starters.length ? 8 + index + week : 1.5])),
  };
}

export function buildDemoWorld() {
  const players = Object.fromEntries(PLAYERS.map((seed) => [seed.id, playerRecord(seed)]));
  const half = presetScoring("HALF_PPR");
  const mainPicks = buildMainDraft();
  const mainDraft = {
    draft_id: "demo_draft_2025",
    league_id: DEMO_CURRENT_LEAGUE_ID,
    status: "complete",
    type: "snake",
    sport: "nfl",
    season: "2025",
    settings: { teams: 4, rounds: 6 },
    draft_order: { u_rowan: 2, u_quinn: 4, u_mila: 1, u_samir: 3 },
    slot_to_roster_id: SLOT_TO_ROSTER,
    start_time: Date.parse("2025-08-20T00:00:00Z"),
    metadata: { name: "Northwind startup draft" },
  };
  const supplemental = {
    ...mainDraft,
    draft_id: "demo_draft_supp",
    metadata: { name: "Northwind supplemental draft" },
    settings: { teams: 4, rounds: 1 },
  };
  const supplementalPicks = [
    { player_id: "demo-p-failed-add", picked_by: "", roster_id: 1, round: 1, draft_slot: 1, pick_no: 1, is_keeper: null, metadata: { first_name: "Zed", last_name: "Marlow", position: "WR", team: "HBR" } },
    { player_id: "demo-p-r4-bn", picked_by: "u_samir", roster_id: 4, round: 1, draft_slot: 2, pick_no: 1, is_keeper: null, metadata: { first_name: "Yuri", last_name: "Nash", position: "RB", team: "BELL" } },
  ];

  const currentPlayers = {
    1: ["demo-p-r1-qb", "demo-p-r1-rb", "demo-p-r1-wr", "demo-p-r1-te", "demo-p-r1-flex", "demo-p-trade-in"],
    2: ["demo-p-r2-qb", "demo-p-r2-rb", "demo-p-r2-wr", "demo-p-r2-te", "demo-p-r2-flex", "demo-p-trade-away"],
    3: ["demo-p-r3-qb", "demo-p-r3-rb", "demo-p-r3-wr", "demo-p-r3-te", "demo-p-r3-flex", "demo-p-waiver-add"],
    4: [...DRAFTED[4]],
  };
  const weekOnePlayers = {
    1: [...DRAFTED[1]],
    2: [...DRAFTED[2]],
    3: [...DRAFTED[3]],
    4: [...DRAFTED[4]],
  };

  const matchups: Record<string, unknown[]> = {};
  for (let week = 1; week <= 6; week += 1) {
    const source = week === 1 ? weekOnePlayers : currentPlayers;
    matchups[`${DEMO_CURRENT_LEAGUE_ID}:${week}`] = [1, 2, 3, 4].map((rosterId) => {
      const rosterPlayers = source[rosterId as 1];
      const starters = rosterPlayers.slice(0, 5);
      const pair = rosterId <= 2 ? 1 : 2;
      return matchup(DEMO_CURRENT_LEAGUE_ID, week, rosterId, pair, rosterPlayers, starters);
    });
  }
  matchups[`${DEMO_PREVIOUS_LEAGUE_ID}:1`] = [
    matchup(DEMO_PREVIOUS_LEAGUE_ID, 1, 1, 1, ["demo-p-r1-qb"], ["demo-p-r1-qb"]),
    matchup(DEMO_PREVIOUS_LEAGUE_ID, 1, 2, 1, ["demo-p-r2-qb"], ["demo-p-r2-qb"]),
  ];

  const transactions: Record<string, unknown[]> = {};
  for (let week = 1; week <= 6; week += 1) transactions[`${DEMO_CURRENT_LEAGUE_ID}:${week}`] = [];
  transactions[`${DEMO_CURRENT_LEAGUE_ID}:2`] = [
    {
      transaction_id: "demo-tx-waiver",
      type: "waiver",
      status: "complete",
      roster_ids: [3],
      consenter_ids: [3],
      creator: "u_mila",
      created: Date.parse("2025-09-18T12:00:00Z"),
      status_updated: Date.parse("2025-09-18T12:05:00Z"),
      leg: 2,
      settings: { waiver_bid: 12 },
      metadata: null,
      adds: { "demo-p-waiver-add": 3 },
      drops: { "demo-p-r3-bn": 3 },
      draft_picks: [],
      waiver_budget: [],
    },
  ];
  transactions[`${DEMO_CURRENT_LEAGUE_ID}:4`] = [
    {
      transaction_id: "demo-tx-failed",
      type: "waiver",
      status: "failed",
      roster_ids: [1],
      consenter_ids: [1],
      creator: "u_rowan",
      created: Date.parse("2025-10-02T12:00:00Z"),
      status_updated: Date.parse("2025-10-02T12:05:00Z"),
      leg: 4,
      settings: { waiver_bid: 7 },
      metadata: null,
      adds: { "demo-p-failed-add": 1 },
      drops: null,
      draft_picks: [],
      waiver_budget: [],
    },
  ];
  transactions[`${DEMO_CURRENT_LEAGUE_ID}:5`] = [
    {
      transaction_id: "demo-tx-trade",
      type: "trade",
      status: "complete",
      roster_ids: [1, 2],
      consenter_ids: [1, 2],
      creator: "u_rowan",
      created: Date.parse("2025-10-09T15:00:00Z"),
      status_updated: Date.parse("2025-10-09T16:00:00Z"),
      leg: 5,
      settings: null,
      metadata: null,
      adds: { "demo-p-trade-in": 1, "demo-p-trade-away": 2 },
      drops: { "demo-p-trade-away": 1, "demo-p-trade-in": 2 },
      draft_picks: [],
      waiver_budget: [],
    },
  ];
  transactions[`${DEMO_PREVIOUS_LEAGUE_ID}:1`] = [];

  const leagueSettings = {
    type: 0,
    best_ball: 0,
    max_keepers: 0,
    start_week: 1,
    last_scored_leg: 6,
    leg: 6,
    playoff_week_start: 15,
    playoff_teams: 4,
    waiver_budget: 100,
    taxi_slots: 0,
    reserve_slots: 1,
    num_teams: 4,
  };

  return {
    state: {
      week: 6,
      leg: 6,
      season: "2025",
      season_type: "regular",
      league_season: "2025",
      previous_season: "2024",
      display_week: 6,
      season_start_date: "2025-09-04",
    },
    leagues: {
      [DEMO_CURRENT_LEAGUE_ID]: {
        league_id: DEMO_CURRENT_LEAGUE_ID,
        name: "Northwind Sunday League",
        season: "2025",
        season_type: "regular",
        status: "in_season",
        sport: "nfl",
        total_rosters: 4,
        previous_league_id: DEMO_PREVIOUS_LEAGUE_ID,
        draft_id: "demo_draft_2025",
        avatar: null,
        roster_positions: ["QB", "RB", "WR", "TE", "FLEX", "BN", "IR"],
        scoring_settings: half,
        settings: leagueSettings,
        metadata: { note: "Fictional demo league" },
      },
      [DEMO_PREVIOUS_LEAGUE_ID]: {
        league_id: DEMO_PREVIOUS_LEAGUE_ID,
        name: "Northwind Sunday League 2024",
        season: "2024",
        season_type: "regular",
        status: "complete",
        sport: "nfl",
        total_rosters: 4,
        previous_league_id: DEMO_CURRENT_LEAGUE_ID,
        draft_id: "demo_draft_2024",
        avatar: null,
        roster_positions: ["QB", "RB", "WR", "TE", "FLEX", "BN"],
        scoring_settings: { ...presetScoring("PPR"), idp_sack: 1 },
        settings: { ...leagueSettings, type: 2, max_keepers: 0, last_scored_leg: 1, leg: 1 },
        metadata: null,
      },
    },
    users: {
      [DEMO_CURRENT_LEAGUE_ID]: USERS,
      [DEMO_PREVIOUS_LEAGUE_ID]: USERS,
    },
    rosters: {
      [DEMO_CURRENT_LEAGUE_ID]: [
        { roster_id: 1, owner_id: "u_rowan", co_owners: null, players: [...currentPlayers[1], "demo-p-missing"], starters: currentPlayers[1].slice(0, 5), reserve: ["demo-p-missing"], taxi: null, keepers: null, settings: { wins: 4, losses: 2, ties: 0, fpts: 640, fpts_decimal: 20 } },
        { roster_id: 2, owner_id: "u_quinn", co_owners: ["u_mila"], players: currentPlayers[2], starters: currentPlayers[2].slice(0, 5), reserve: null, taxi: null, keepers: null, settings: { wins: 3, losses: 3, ties: 0 } },
        { roster_id: 3, owner_id: "u_mila", co_owners: null, players: currentPlayers[3], starters: currentPlayers[3].slice(0, 5), reserve: null, taxi: null, keepers: null, settings: { wins: 3, losses: 3, ties: 0 } },
        { roster_id: 4, owner_id: null, co_owners: null, players: currentPlayers[4], starters: currentPlayers[4].slice(0, 5), reserve: null, taxi: null, keepers: null, settings: { wins: 2, losses: 4, ties: 0 } },
      ],
      [DEMO_PREVIOUS_LEAGUE_ID]: [
        { roster_id: 1, owner_id: "u_quinn", co_owners: null, players: ["demo-p-r1-qb"], starters: ["demo-p-r1-qb"], reserve: null, taxi: null, keepers: null, settings: { wins: 8, losses: 6, ties: 0 } },
        { roster_id: 2, owner_id: "u_rowan", co_owners: null, players: ["demo-p-r2-qb"], starters: ["demo-p-r2-qb"], reserve: null, taxi: null, keepers: null, settings: { wins: 6, losses: 8, ties: 0 } },
      ],
    },
    drafts: {
      [DEMO_CURRENT_LEAGUE_ID]: [mainDraft, supplemental],
      [DEMO_PREVIOUS_LEAGUE_ID]: [
        {
          draft_id: "demo_draft_2024",
          league_id: DEMO_PREVIOUS_LEAGUE_ID,
          status: "complete",
          type: "auction",
          sport: "nfl",
          season: "2024",
          settings: { teams: 4, rounds: 1 },
          draft_order: null,
          slot_to_roster_id: { "1": 1 },
          start_time: Date.parse("2024-08-20T00:00:00Z"),
          metadata: { name: "Northwind auction" },
        },
      ],
    },
    draftDetails: {} as Record<string, unknown>,
    picks: {
      demo_draft_2025: mainPicks,
      demo_draft_supp: supplementalPicks,
      demo_draft_2024: [
        { player_id: "demo-p-r1-qb", picked_by: "u_quinn", roster_id: 1, round: 1, draft_slot: 1, pick_no: 1, is_keeper: null, metadata: { first_name: "Adrian", last_name: "Cole", position: "QB", team: "HBR" } },
      ],
    },
    tradedPicks: {
      [DEMO_CURRENT_LEAGUE_ID]: [{ season: "2026", round: 3, roster_id: 1, previous_owner_id: 1, owner_id: 2 }],
      [DEMO_PREVIOUS_LEAGUE_ID]: [],
    },
    matchups,
    transactions,
    players,
  };
}

const world = buildDemoWorld();
world.draftDetails = Object.fromEntries(
  Object.values(world.drafts)
    .flat()
    .map((draft) => [String((draft as { draft_id: string }).draft_id), draft]),
);

export const demoWorld = world;
