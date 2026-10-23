import { z } from "zod";

const unknownRecord = z.record(z.string(), z.unknown());

export const sleeperUserSchema = z
  .object({
    user_id: z.string(),
    username: z.string().nullable().optional(),
    display_name: z.string().nullable().optional(),
    avatar: z.string().nullable().optional(),
  })
  .strip();

export const sleeperLeagueUserSchema = z
  .object({
    user_id: z.string(),
    display_name: z.string().nullable().optional(),
    avatar: z.string().nullable().optional(),
    is_owner: z.boolean().nullable().optional(),
    metadata: unknownRecord.nullable().optional(),
  })
  .strip();

export const sleeperLeagueSchema = z
  .object({
    league_id: z.string(),
    name: z.string(),
    season: z.string(),
    season_type: z.string().nullable().optional(),
    status: z.string(),
    sport: z.string(),
    total_rosters: z.number().int().nullable().optional(),
    previous_league_id: z.string().nullable().optional(),
    draft_id: z.string().nullable().optional(),
    avatar: z.string().nullable().optional(),
    roster_positions: z.array(z.string()).nullable().optional(),
    scoring_settings: unknownRecord.nullable().optional(),
    settings: unknownRecord.nullable().optional(),
    metadata: unknownRecord.nullable().optional(),
  })
  .strip();

export const sleeperRosterSchema = z
  .object({
    roster_id: z.number().int(),
    owner_id: z.string().nullable().optional(),
    co_owners: z.array(z.string()).nullable().optional(),
    players: z.array(z.string().nullable()).nullable().optional(),
    starters: z.array(z.string().nullable()).nullable().optional(),
    reserve: z.array(z.string().nullable()).nullable().optional(),
    taxi: z.array(z.string().nullable()).nullable().optional(),
    keepers: z.unknown().nullable().optional(),
    settings: unknownRecord.nullable().optional(),
  })
  .strip();

export const sleeperMatchupSchema = z
  .object({
    roster_id: z.number().int(),
    matchup_id: z.number().int().nullable().optional(),
    points: z.number().nullable().optional(),
    custom_points: z.number().nullable().optional(),
    players: z.array(z.string().nullable()).nullable().optional(),
    starters: z.array(z.string().nullable()).nullable().optional(),
    starters_points: z.array(z.number().nullable()).nullable().optional(),
    players_points: z.record(z.string(), z.number().nullable()).nullable().optional(),
  })
  .strip();

export const sleeperDraftSchema = z
  .object({
    draft_id: z.string(),
    league_id: z.string().nullable().optional(),
    status: z.string(),
    type: z.string(),
    sport: z.string(),
    season: z.string(),
    settings: unknownRecord.nullable().optional(),
    draft_order: z.record(z.string(), z.number()).nullable().optional(),
    slot_to_roster_id: z.record(z.string(), z.number()).nullable().optional(),
    start_time: z.number().nullable().optional(),
    metadata: unknownRecord.nullable().optional(),
  })
  .strip();

export const sleeperDraftPickSchema = z
  .object({
    player_id: z.string().nullable().optional(),
    picked_by: z.string().nullable().optional(),
    roster_id: z.union([z.string(), z.number()]).nullable().optional(),
    round: z.number().nullable().optional(),
    draft_slot: z.number().nullable().optional(),
    pick_no: z.number().nullable().optional(),
    metadata: unknownRecord.nullable().optional(),
    is_keeper: z.boolean().nullable().optional(),
  })
  .strip();

export const sleeperTradedPickSchema = z
  .object({
    season: z.union([z.string(), z.number()]),
    round: z.number().int(),
    roster_id: z.number().int(),
    previous_owner_id: z.number().int().nullable().optional(),
    owner_id: z.number().int(),
  })
  .strip();

export const sleeperTransactionSchema = z
  .object({
    transaction_id: z.string(),
    type: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    roster_ids: z.array(z.number()).nullable().optional(),
    consenter_ids: z.array(z.number()).nullable().optional(),
    creator: z.string().nullable().optional(),
    created: z.number().nullable().optional(),
    status_updated: z.number().nullable().optional(),
    leg: z.number().nullable().optional(),
    settings: unknownRecord.nullable().optional(),
    metadata: z.unknown().nullable().optional(),
    adds: z.record(z.string(), z.number()).nullable().optional(),
    drops: z.record(z.string(), z.number()).nullable().optional(),
    draft_picks: z
      .array(
        z
          .object({
            season: z.union([z.string(), z.number()]).nullable().optional(),
            round: z.number().nullable().optional(),
            roster_id: z.number().nullable().optional(),
            previous_owner_id: z.number().nullable().optional(),
            owner_id: z.number().nullable().optional(),
          })
          .strip(),
      )
      .nullable()
      .optional(),
    waiver_budget: z
      .array(
        z
          .object({
            sender: z.number().nullable().optional(),
            receiver: z.number().nullable().optional(),
            amount: z.number().nullable().optional(),
          })
          .strip(),
      )
      .nullable()
      .optional(),
  })
  .strip();

export const sleeperPlayerSchema = z
  .object({
    player_id: z.string().nullable().optional(),
    first_name: z.string().nullable().optional(),
    last_name: z.string().nullable().optional(),
    full_name: z.string().nullable().optional(),
    position: z.string().nullable().optional(),
    fantasy_positions: z.array(z.string()).nullable().optional(),
    team: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    injury_status: z.string().nullable().optional(),
    search_rank: z.number().nullable().optional(),
  })
  .strip();

export const sleeperNflStateSchema = z
  .object({
    week: z.number().int(),
    leg: z.number().int(),
    season: z.string(),
    season_type: z.string(),
    league_season: z.string().optional(),
    previous_season: z.string().optional(),
    display_week: z.number().int().optional(),
    season_start_date: z.string().optional(),
  })
  .strip();

export const sleeperTrendingSchema = z
  .object({
    player_id: z.string(),
    count: z.number(),
  })
  .strip();

export type SleeperUser = z.infer<typeof sleeperUserSchema>;
export type SleeperLeagueUser = z.infer<typeof sleeperLeagueUserSchema>;
export type SleeperLeague = z.infer<typeof sleeperLeagueSchema>;
export type SleeperRoster = z.infer<typeof sleeperRosterSchema>;
export type SleeperMatchup = z.infer<typeof sleeperMatchupSchema>;
export type SleeperDraft = z.infer<typeof sleeperDraftSchema>;
export type SleeperDraftPick = z.infer<typeof sleeperDraftPickSchema>;
export type SleeperTradedPick = z.infer<typeof sleeperTradedPickSchema>;
export type SleeperTransaction = z.infer<typeof sleeperTransactionSchema>;
export type SleeperPlayer = z.infer<typeof sleeperPlayerSchema>;
export type SleeperNflState = z.infer<typeof sleeperNflStateSchema>;
