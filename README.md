# Tendencies

Know your habits. Build a better team.

Tendencies is a Sleeper fantasy-football coaching app. This repository currently implements the first slice: resolve a public league, choose a roster, import it with a resumable worker, and show the stored roster, matchups, and draft picks.

It does not ask for Sleeper credentials. A username lookup is not a login. Coaching reports, waiver rankings, trade values, and ADP comparisons are not implemented yet, and the app does not invent those numbers.

## Setup

Requirements: Node.js 22+, pnpm, and Docker.

```bash
pnpm install
cp .env.example .env
pnpm db:up
pnpm db:migrate
```

Run the site and the import worker in two terminals:

```bash
pnpm dev
pnpm worker
```

Open http://localhost:3000. Postgres is published on port **5433** so it does not collide with a local Postgres already using 5432.

`DATABASE_URL` in `.env.example` matches the Docker Compose credentials.

## Analyze a league

- Enter a public Sleeper league id, or a username and season, then choose **Analyze this team**.
- The request inserts an `ImportJob` and returns. The worker performs the import. The team page polls that job and renders rows as they are saved.
- Or open the fictional Northwind demo. It is labeled demo data and uses the same import code.

The worker must be running. A queued job tells you to start `pnpm worker`.

## What this version imports

From `https://api.sleeper.app/v1`:

- League settings, scoring, and roster slots
- Managers, using stable user ids
- Current rosters, including null owners and co-owners
- Every draft, with roster attribution from the pick or `slot_to_roster_id`
- Traded picks
- Matchups and transactions from `start_week` through the last scored leg
- Previous seasons, with cycle detection, up to `IMPORT_HISTORY_LIMIT` (default 3)
- The NFL player directory, at most once every 24 hours

Completed weeks stay cached until **Reload completed weeks**. Current-week data and league metadata refresh after 15 minutes. A refresh still goes through those limits and the Sleeper rate limiter.

## Supported and unsupported formats

Supported for display and later scoring work: NFL, snake redraft, and the standard, half-PPR, and PPR preset defined in `src/domain/scoring.ts`.

The importer still stores other leagues. It names the gap instead of applying a redraft preset:

- Custom or incomplete scoring keys
- `settings.type` 2 (dynasty) and non-zero `max_keepers`
- Auction drafts
- IDP roster spots or non-zero `idp_` scoring
- Non-NFL sports
- Best ball, when `best_ball` is 1

Only `settings.type = 0` was observed on a live league during development. Types 1 and 2 use the conventional Sleeper mapping, and the raw code is always shown.

## Data that is not connected

Checked on 23 October 2026, not ingested:

- nflverse weekly stats: `nflverse-data` release `stats_player`, file `stats_player_week_2025.csv.gz`. Its `player_id` is not a Sleeper id. `players.csv` has no `sleeper_id` column.
- Snap counts: `snap_counts_2025.csv` includes `offense_pct` and does not include routes.
- `target_share` exists on the weekly file and is unused until its definition is confirmed.
- Historical ADP and projections. Sleeper `search_rank` is stored and is not shown as ADP.

Details are in `docs/data-contracts.md`.

## Tests

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:db
```

`pnpm test` uses the demo provider and an in-memory store. `pnpm test:db` requires the Docker database and migration.

## Privacy

Sleeper's user payload can include email, phone, and token fields. Those are discarded. League chat fields are discarded. Manager pages send `noindex`. The app reads public league information only.

Sleeper documents the API as free for non-commercial use and asks commercial users to contact api@sleeper.app. No paid API or LLM key is required.
