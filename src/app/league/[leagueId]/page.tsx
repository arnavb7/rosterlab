import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";

import { startAnalysis } from "@/app/actions";
import { leagueIdSchema } from "@/lib/validators";
import { ProviderError } from "@/server/providers/errors";
import { loadLeaguePreview } from "@/server/preview/league-preview";

export default function LeaguePage({
  params,
  searchParams,
}: {
  params: Promise<{ leagueId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-muted">Resolving league…</p>}>
      <LeagueChooser params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function LeagueChooser({
  params,
  searchParams,
}: {
  params: Promise<{ leagueId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  await connection();
  const { leagueId } = await params;
  const query = await searchParams;
  if (!leagueIdSchema.safeParse(leagueId).success) {
    return <p className="text-danger">That league id is not valid.</p>;
  }
  let preview = null;
  let errorMessage: string | null = null;
  try {
    preview = await loadLeaguePreview(leagueId);
  } catch (error) {
    errorMessage = error instanceof ProviderError ? error.message : "The league could not be loaded.";
  }
  if (errorMessage) return <p className="text-danger">{errorMessage}</p>;
  if (!preview) return <p>No league was found for that id.</p>;
  return (
      <div>
        {preview.demo ? (
          <p className="mb-4 rounded-md border border-amber px-3 py-2 text-sm text-amber">
            Demo data. Northwind is fictional and is not a Sleeper league.
          </p>
        ) : null}
        <p className="text-sm text-muted">{preview.season}</p>
        <h1 className="mt-1 text-3xl font-semibold">{preview.name}</h1>
        <p className="mt-2 text-sm text-muted">
          {preview.fromCache
            ? `Showing league data fetched at ${preview.fetchedAt}. Refreshes still respect the 15-minute cache.`
            : `Fetched ${preview.fetchedAt}.`}
        </p>
        {query.error === "rate" ? (
          <p className="mt-3 text-sm text-amber">Import requests are temporarily limited. Wait and try again.</p>
        ) : null}
        <ul className="mt-4 space-y-1 text-sm text-muted">
          {preview.formatLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {preview.disabledAnalyses.length > 0 ? (
          <ul className="mt-4 space-y-1 text-sm text-amber">
            {preview.disabledAnalyses.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
        <h2 className="mt-8 text-lg font-semibold">Choose a roster</h2>
        <p className="mt-1 text-sm text-muted">Player names appear after the import. This page only shows roster identity.</p>
        <ul className="mt-4 grid gap-3">
          {preview.rosters.map((roster) => (
            <li key={roster.rosterId} className="rounded-lg border border-line p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <p className="font-semibold">{roster.teamName || roster.ownerName}</p>
                  <p className="text-sm text-muted">
                    Roster {roster.rosterId} · {roster.ownerName}
                    {roster.record ? ` · ${roster.record}` : ""} · {roster.playerCount} players
                  </p>
                </div>
                <form action={startAnalysis}>
                  <input type="hidden" name="leagueId" value={preview.leagueId} />
                  <input type="hidden" name="rosterId" value={roster.rosterId} />
                  <button className="rounded-md bg-teal px-3 py-2 text-sm font-semibold text-background" type="submit">
                    Analyze this team
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm">
          <Link href="/">Choose a different league</Link>
        </p>
      </div>
    );
}
