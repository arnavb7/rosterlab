# Tendencies architecture

Working name: Tendencies. Milestone 1 is a TypeScript modular monolith: a Next.js app enqueues imports, and a separate worker process writes normalized league data to PostgreSQL.

## Implementation plan

1. Foundation: Next.js app shell, PostgreSQL, Prisma, provider boundaries, and a database-backed job queue.
2. First vertical slice: enter a Sleeper league id, resolve the league, choose a roster, run a resumable import, and show the imported roster, matchups, and draft picks.
3. Keep domain types and provider interfaces ready for manager reports, draft strategy, waivers, and trades without implementing those analyses yet.
4. Prove the slice with fixture-backed unit tests and a PostgreSQL import test. Demo data uses the same import and view code as live data and stays labeled.

Later milestones, not built in this pass: coaching insights, draft strategy, nflverse ingestion, waiver labels, the lineup optimizer, and trade search.

## Runtime

- Web: Next.js App Router. Server components read PostgreSQL. The browser does not call Sleeper and does not download the player directory.
- Worker: `pnpm worker` polls `ImportJob`, claims one job with `FOR UPDATE SKIP LOCKED`, and runs the import. A web request only inserts the job row and returns its id.
- Database: PostgreSQL via Docker Compose on port 5433, so it does not collide with a Postgres already bound to 5432.

Cache Components stay enabled. Pages that read the database or Sleeper render that work inside a Suspense boundary after `connection()`.

## Request path

```text
Browser
  -> / or /lookup/user/[username] or /league/[leagueId]
  -> Sleeper preview (15-minute server cache, rate limited)
  -> Server Action inserts ImportJob
  -> /league/[leagueId]/team/[rosterId]?job=
  -> browser polls GET /api/jobs/[jobId]
  -> worker imports
  -> server component reads normalized tables
```

Selecting a team stores `tendencies.analysisContext` in localStorage. That is a convenience pointer, not authentication.

## Modules

- `src/domain`: pure scoring classification, lineup-format detection, week planning, cache policy, draft attribution, transaction normalization, and feature availability.
- `src/server/providers/sleeper`: allowlisted HTTP client, Zod validation, and response normalization.
- `src/server/ingestion`: import state machine and store interface. Prisma and an in-memory store both implement it.
- `src/server/jobs`: enqueue, claim, retry, and the worker loop.
- `src/server/queries`: load normalized rows and build the team view. Charts and pages do not calculate business rules.
- `src/fixtures/demo`: one fictional league. The demo provider implements the same client interface as HTTP.

## Import stages

For each league in the history chain:

1. League settings
2. Managers
3. Current rosters
4. Draft list, then each draft's detail and picks
5. Traded picks
6. Matchup weeks from `start_week` through the last scored leg
7. Transactions for those weeks
8. Referenced players from the cached directory
9. Decide whether `previous_league_id` continues the chain

The cursor is saved after every unit. A crashed worker resumes at that unit. Upserts are idempotent. Retryable upstream failures requeue the job with backoff. A bad historical season does not discard the requested league.

## Cache policy

| Data | Upstream refresh |
| --- | --- |
| Player directory | At most once every 24 hours, including correction runs |
| League metadata and current rosters | 15 minutes |
| Partial current-week matchups and transactions | 15 minutes |
| Completed weeks and completed drafts | Kept until a correction import |

A user refresh still passes the rate limiter and these TTLs. Correction mode is the only way to re-download completed weeks. Empty matchup payloads do not delete rows already stored.

## Provider boundary

`SleeperClient` is the only upstream football API in this milestone. URLs are built from `https://api.sleeper.app` path segments. User-supplied URLs are not fetched.

Demo jobs can only target `demo-*` league ids. Live jobs refuse `demo-*` ids, so fixture players cannot be written into a Sleeper league import.

## Privacy

The app reads public league data. It does not ask for Sleeper credentials. User records keep `user_id`, username when the user endpoint is queried directly, display name, avatar, commissioner flag, and team name. Email, phone, token, and league chat fields are dropped before anything is stored. Manager pages send `noindex`.

## What is intentionally absent

Manager scores, waiver rankings, trade gains, ADP, projections, snap counts, and scheme fit are not estimated. Pages that need them are not presented as working. The data page states which provider is missing.
