# Progress

## Milestone 1 — Foundation and real league import

Status: the first vertical slice works.

Enter a league id or username, choose a roster, and a worker imports that league. The team page shows the stored roster, weekly matchups, draft picks, and transactions. Demo data uses the same import and view code and stays labeled.

### Verified

- Typecheck, lint, 24 unit tests, and a PostgreSQL import test pass.
- Browser: Northwind demo goes from the league page to Harbor Lights, with starters, a partial week, the draft board, a failed waiver kept out of executed decisions, and the trade that moved Lila Ortiz and Farah Nguyen.
- Browser: public Sleeper league `289646328504385536` (Sleeper Friends League, 2018) resolves without credentials and imports in 81 steps. Roster 1 shows directory names such as Alvin Kamara. Scoring is reported as custom because `pass_td`, `pass_int`, and field-goal miss keys do not match a preset. Keeper rules are shown from `max_keepers`. The 2017 season is linked without assuming the same roster number is the same manager.

### Implemented

- Next.js app shell, dark scouting layout, and routes for analyze, league preview, team, username lookup, and data.
- PostgreSQL schema and Prisma migration for the import entities.
- Sleeper client with an allowlisted host, retries, 429 handling, and request limiting.
- Resumable `ImportJob` queue. The web request only inserts the job. `pnpm worker` runs it.
- Player directory file cache, 24-hour refresh, referenced players only in the database.
- Format and scoring classification. Unsupported leagues are stored and the gap is named.
- Previous-league chain with cycle detection.
- Fictional Northwind fixture, including an unresolved player, a partial week, a failed waiver, a slot-to-roster map that is not the identity map, and a prior dynasty/auction season.

### Not implemented

- Manager report and coaching rules
- Draft strategy labels and ADP
- Waiver usage rankings
- Trade search and the lineup optimizer
- Recommendation history
- nflverse or CSV ingestion
- Playwright end-to-end tests

### Blocked on a real provider

- Joining Sleeper players to nflverse. `players.csv` has no Sleeper id, checked 23 October 2026.
- Historical ADP, projections, and route participation. Those sources are not connected, so the related pages are absent rather than filled with estimates.

### Next

Milestone 2: deterministic manager metrics and the draft board's positional construction, still without treating outcomes as proof of process.
