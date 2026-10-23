import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";

import { startAnalysis } from "@/app/actions";
import { ImportStatus } from "@/components/import-status";
import { RememberAnalysis } from "@/components/remember-analysis";
import { TeamExplorer } from "@/components/team-explorer";
import { jobIdSchema, leagueIdSchema, rosterIdSchema } from "@/lib/validators";
import { loadTeamView } from "@/server/queries/load-team";

export default function TeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ leagueId: string; rosterId: string }>;
  searchParams: Promise<{ job?: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-muted">Loading imported data…</p>}>
      <TeamContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function TeamContent({
  params,
  searchParams,
}: {
  params: Promise<{ leagueId: string; rosterId: string }>;
  searchParams: Promise<{ job?: string }>;
}) {
  await connection();
  const { leagueId, rosterId: rosterRaw } = await params;
  const query = await searchParams;
  if (!leagueIdSchema.safeParse(leagueId).success || !rosterIdSchema.safeParse(Number(rosterRaw)).success) {
    return <p className="text-danger">That league or roster is not valid.</p>;
  }
  const rosterId = Number(rosterRaw);
  const jobId = query.job && jobIdSchema.safeParse(query.job).success ? query.job : null;
  let view = null;
  let databaseError = false;
  try {
    view = await loadTeamView(leagueId, rosterId);
  } catch {
    databaseError = true;
  }
  if (databaseError) {
    return (
      <p className="text-danger">
        The database is unavailable. Start PostgreSQL and run <code className="font-mono">pnpm db:migrate</code>.
      </p>
    );
  }
  if (!view) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold">Import queued</h1>
        <p className="text-muted">Roster, matchups, and draft picks appear as each import step finishes.</p>
        {jobId ? <ImportStatus jobId={jobId} /> : <p>No import job is attached to this page.</p>}
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {view.demo ? (
        <p className="rounded-md border border-amber px-3 py-2 text-sm text-amber">
          Demo data. This league is fictional and is not mixed with live Sleeper results.
        </p>
      ) : null}
      <RememberAnalysis
        leagueId={view.leagueId}
        rosterId={view.rosterId}
        leagueName={view.leagueName}
        teamName={view.teamName || view.ownerName}
        demo={view.demo}
      />
      <header>
        <p className="text-sm text-muted">
          {view.season} · {view.phase} · roster {view.rosterId}
        </p>
        <h1 className="mt-1 text-3xl font-semibold">{view.teamName || view.ownerName}</h1>
        <p className="mt-1 text-muted">
          {view.leagueName}
          {view.teamName ? ` · ${view.ownerName}` : ""}
          {view.coOwners.length > 0 ? ` · co-owners ${view.coOwners.join(", ")}` : ""}
        </p>
        <p className="mt-2 font-mono text-sm text-muted">
          {view.record ? `${view.record}` : "Record not on the roster payload"}
          {view.seasonPoints ? ` · Sleeper season points ${view.seasonPoints}` : ""}
          {view.lastSyncedAt ? ` · synced ${view.lastSyncedAt}` : ""}
        </p>
      </header>
      {jobId ? <ImportStatus jobId={jobId} /> : null}
      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-lg border border-line p-4">
          <h2 className="font-semibold">Format</h2>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {view.formatLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
            {view.scoringDetail.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </article>
        <article className="rounded-lg border border-line p-4">
          <h2 className="font-semibold">Limits</h2>
          <ul className="mt-2 space-y-2 text-sm text-muted">
            {view.disabledAnalyses.map((line) => (
              <li key={line}>{line}</li>
            ))}
            {view.unavailableFeatures.map((feature) => (
              <li key={feature.label}>
                <span className="text-foreground">{feature.label}.</span> {feature.reason}
              </li>
            ))}
          </ul>
        </article>
      </section>
      {view.notices.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {view.notices.map((notice) => (
            <li key={notice.message} className={notice.level === "warning" ? "text-amber" : "text-muted"}>
              {notice.message}
            </li>
          ))}
        </ul>
      ) : null}
      <TeamExplorer view={view} />
      {view.tradedPicks.length > 0 ? (
        <section>
          <h2 className="font-semibold">Traded picks</h2>
          <p className="mt-1 text-sm text-muted">These picks are history only. They are not valued.</p>
          <ul className="mt-2 text-sm">
            {view.tradedPicks.map((pick) => (
              <li key={`${pick.season}-${pick.round}-${pick.originalRosterId}`}>
                {pick.season} round {pick.round}, original roster {pick.originalRosterId}, current roster {pick.ownerRosterId}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {view.related.length > 0 ? (
        <section>
          <h2 className="font-semibold">Other imported seasons</h2>
          <p className="mt-1 text-sm text-muted">Roster numbers are not assumed to belong to the same manager.</p>
          <ul className="mt-2 text-sm">
            {view.related.map((season) => (
              <li key={season.externalLeagueId}>
                <Link href={`/league/${season.externalLeagueId}`}>
                  {season.season} · {season.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <form action={startAnalysis}>
        <input type="hidden" name="leagueId" value={view.leagueId} />
        <input type="hidden" name="rosterId" value={view.rosterId} />
        <input type="hidden" name="correction" value="1" />
        <button className="text-sm text-muted underline-offset-2 hover:underline" type="submit">
          Reload completed weeks
        </button>
      </form>
      <p className="text-sm">
        <Link href={`/league/${view.leagueId}`}>Choose another roster</Link>
      </p>
    </div>
  );
}
