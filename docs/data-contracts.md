# Data contracts

Verified against the public Sleeper API on 23 October 2026 unless a row says otherwise. Fields that were not observed are not invented.

## Sleeper

Base URL: `https://api.sleeper.app/v1`. Read-only. No token. Official docs: https://docs.sleeper.com/. The docs state the API is free for non-commercial use and ask commercial users to contact api@sleeper.app. Stay under the documented guidance of 1,000 calls per minute. This app uses a stricter process limit: 4 concurrent requests and at least 120 ms between starts, with exponential backoff and `Retry-After` handling for HTTP 429.

| Resource | Used for |
| --- | --- |
| `GET /user/{username_or_user_id}` | Resolve a manager. A missing user returns JSON `null`. |
| `GET /user/{user_id}/leagues/nfl/{season}` | League list for a season. |
| `GET /league/{league_id}` | League identity, scoring, roster slots, settings. |
| `GET /league/{league_id}/users` | Display names and team names. |
| `GET /league/{league_id}/rosters` | Current roster snapshot only. |
| `GET /league/{league_id}/matchups/{week}` | One team row per roster for that week. |
| `GET /league/{league_id}/transactions/{week}` | Waivers, free agents, and trades for that week. |
| `GET /league/{league_id}/drafts` | Every draft. This list can omit `slot_to_roster_id`. |
| `GET /draft/{draft_id}` | Draft detail, including `slot_to_roster_id` when Sleeper has it. |
| `GET /draft/{draft_id}/picks` | Picks. `roster_id` may be a number or a string and is not the draft slot. |
| `GET /league/{league_id}/traded_picks` | Current traded-pick ownership. |
| `GET /players/nfl` | Player directory. Cached for 24 hours. |
| `GET /state/nfl` | Current season, week, and season type. |
| `GET /players/nfl/trending/{add\|drop}` | Client method only. Not used to judge availability or quality. |

External ids stay strings, except roster ids, which are league-scoped integers. Usernames are not treated as stable; `user_id` is.

### Observed league shape

League `289646328504385536` (`Sleeper Friends League`, 2018, status `complete`) confirmed these behaviors:

- `settings.start_week` can be greater than 1. Week plans start there.
- `settings.last_scored_leg` and `settings.leg` bound the weeks to fetch. The importer does not assume 17 or 18 weeks. A week number above 30 is capped and reported.
- `settings.playoff_week_start` marks that week and later as postseason.
- `settings.type` was `0` while `settings.max_keepers` was `3`. Keeper rules are detected from either signal. The official docs do not define `type`. This app maps `0` to redraft, `1` to keeper, and `2` to dynasty, and it always retains the raw code. Only `0` was observed live in this session.
- `settings.best_ball` is absent on some leagues. Absent means best ball was not indicated, not that it was checked and turned off.
- Scoring values can be binary-float artifacts (`pass_yd` was `0.03999999910593033`). Comparisons use a tolerance of `0.001`.
- `GET /league/{id}/drafts` omitted `slot_to_roster_id`; `GET /draft/{id}` included it. On that draft, pick `roster_id` differed from `draft_slot` for every pick.
- `GET /user/thisuserdoesnotexist_zz` returned `null`.
- `GET /matchups/30` returned `[]`, not an error. An empty week inside the planned range is stored as missing and does not erase older rows.
- Roster objects include `co_owners`, `taxi`, `reserve`, and `keepers`, any of which may be null.
- League user objects from this league did not include `username`. The separate user endpoint does.
- The user endpoint can include `email`, `phone`, and `token`. Those keys are discarded and are not written to the database.
- League payloads can include `last_message_*` chat fields. Those keys are discarded.

### Scoring presets

A league is `STANDARD`, `HALF_PPR`, or `PPR` only when `rec` is `0`, `0.5`, or `1` and every catalog key below is present and matches. Any other non-zero key is listed as unsupported. A differing catalog key is listed as divergent. Missing required keys produce `INCOMPLETE`. None of those cases are silently treated as a preset.

Shared catalog: `pass_yd` 0.04, `pass_td` 4, `pass_int` -1, `pass_2pt` 2, `rush_yd` 0.1, `rush_td` 6, `rush_2pt` 2, `rec_yd` 0.1, `rec_td` 6, `rec_2pt` 2, `fum_lost` -2, `xpm` 1, `xpmiss` -1, `fgm_0_19` 3, `fgm_20_29` 3, `fgm_30_39` 3, `fgm_40_49` 4, `fgm_50p` 5, `sack` 1, `int` 2, `fum_rec` 2, `safe` 2, `def_td` 6, `blk_kick` 2, `ff` 1, `st_td` 6, `st_ff` 1, `st_fum_rec` 1, `pts_allow_0` 10, `pts_allow_1_6` 7, `pts_allow_7_13` 4, `pts_allow_14_20` 1, `pts_allow_21_27` 0, `pts_allow_28_34` -1, `pts_allow_35p` -4.

The observed 2018 league is not one of these presets (`pass_td` 6, `pass_int` -2, non-zero field-goal misses). The importer still stores it and the UI names the divergent keys.

### Draft attribution

1. Use the pick's `roster_id` when it parses as an integer.
2. Otherwise use `slot_to_roster_id[draft_slot]` from the draft detail.
3. Otherwise leave the roster unresolved.

Draft slot is never copied into roster id on its own. Picks are stored by a stable ordinal because source `pick_no` values can be missing or duplicated. Irregularities are saved on the pick.

### Transactions

`status === "complete"` is the only executed decision. Failed and pending rows are stored and labeled. Absence of a row is not treated as a failed claim. Adds, drops, draft picks, and FAAB movements become `TransactionAsset` rows.

### Rosters versus history

`RosterSnapshot` with `snapshotKind = CURRENT` is the current roster endpoint. Weekly `MatchupTeamWeek` rows are the historical lineup record. The two are not merged. Ownership is stored per league season, so a previous season can show a different owner for the same roster number.

### History chain

`previous_league_id` is followed with cycle detection. `IMPORT_HISTORY_LIMIT` is the number of previous seasons, default 3. The requested league is always first.

## Identity and supplemental football data

These sources were checked on 23 October 2026. No adapter reads them yet.

| Source | What was verified | Constraint |
| --- | --- | --- |
| `nflverse-data` release `stats_player`, file `stats_player_week_2025.csv.gz` | Header includes `player_id`, `season`, `week`, `season_type`, `team`, `targets`, `target_share`, `carries`, `receptions`, `fantasy_points`, `fantasy_points_ppr` | `player_id` is not a Sleeper id. `target_share` is present, but this app will not use it until its denominator is confirmed. The wrong path `player_stats/stats_player_week_2025.csv` returns 404. |
| Release `snap_counts`, file `snap_counts_2025.csv` | Header: `game_id`, `season`, `game_type`, `week`, `player`, `pfr_player_id`, `position`, `team`, `opponent`, `offense_snaps`, `offense_pct`, `defense_snaps`, `defense_pct`, `st_snaps`, `st_pct` | Snap percentage must use `offense_pct` only when that column's definition is confirmed. There is no route-participation column. |
| Release `schedules`, file `games.csv` | Game identity, week, teams, and kickoff fields are present. | Also contains betting columns. Those are not product inputs. |
| Release `players`, file `players.csv` | 39 identity columns including `gsis_id`, `espn_id`, `pfr_id`, and name fields. | No `sleeper_id` column. Names cannot be used to attach Sleeper players to these rows. |
| Release `stats_team` | The release exists. | Column contract is not copied here because the adapter is not implemented. |

Player identity mapping therefore has a table and no population step. Unresolved Sleeper ids stay visible. Scheme fit is unavailable. Route-derived waiver metrics are unavailable. Historical ADP and projections are unavailable until a timestamped CSV import exists.

## Stored entities in this milestone

`SleeperUser`, `LeagueSeason`, `LeagueMembership`, `RosterSnapshot`, `MatchupTeamWeek`, `LeagueTransaction`, `TransactionAsset`, `Draft`, `DraftPick`, `TradedPick`, `Player`, `PlayerIdentityMapping` (unused), `ProviderCapability`, `ImportJob`, `RawPayload`.

Idempotency keys:

- League season: Sleeper league id
- Membership: league id + Sleeper user id
- Current roster: league id + roster id + `CURRENT`
- Matchup: league id + week + roster id
- Transaction: league id + Sleeper transaction id
- Draft pick: internal draft id + ordinal
- Traded pick: league id + season + round + original roster id
- Player: Sleeper player id
- Raw payload: provider + resource + key, latest copy only

`Player.searchRank` may hold Sleeper `search_rank`. It is not historical ADP and is not part of the team view.

Insight, recommendation, weekly stats, usage, ranking, and projection tables are specified in the product requirements and are not created until the milestone that has a real source for them.

## Demo fixture

League `demo-northwind` is fictional. It includes a snake draft whose slot-to-roster map is not the identity map, a previous season with a different roster owner, a cycle back to the current season, a partial week, a completed trade, a failed waiver, an unresolved player id, and a previous season marked dynasty and auction with an unsupported `idp_sack` value. Player ids are prefixed `demo-p-` so they cannot collide with numeric Sleeper ids.
