import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";

import { seasonSchema, usernameSchema } from "@/lib/validators";
import { ProviderError } from "@/server/providers/errors";
import { loadNflSeasons, loadUserLeagues } from "@/server/preview/league-preview";

export default function UserPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  return (
    <Suspense fallback={<p className="text-muted">Looking up that username…</p>}>
      <UserLeagues params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function UserLeagues({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  await connection();
  const { username } = await params;
  const query = await searchParams;
  if (!usernameSchema.safeParse(username).success) {
    return <p className="text-danger">That username is not valid.</p>;
  }
  let lookup = null;
  let season = "";
  let errorMessage: string | null = null;
  try {
    const seasons = await loadNflSeasons();
    season = seasonSchema.safeParse(query.season).success ? query.season! : seasons.leagueSeason;
    lookup = await loadUserLeagues(username, season);
  } catch (error) {
    errorMessage = error instanceof ProviderError ? error.message : "Sleeper could not be reached.";
  }
  if (errorMessage) return <p className="text-danger">{errorMessage}</p>;
  if (!lookup) return <p>No Sleeper user was found for that username.</p>;
  return (
      <div>
        <p className="text-sm text-muted">Public profile · not an account login</p>
        <h1 className="mt-1 text-3xl font-semibold">{lookup.displayName || lookup.username || "Sleeper user"}</h1>
        <p className="mt-2 font-mono text-sm text-muted">user id {lookup.userId}</p>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Usernames can change. This lookup stores nothing private and does not verify that you control the account.
        </p>
        <div className="mt-4 flex gap-3 text-sm">
          {lookup.seasonsOffered.map((item) => (
            <Link key={item} href={`/lookup/user/${username}?season=${item}`} className={item === season ? "text-teal" : "text-muted"}>
              {item}
            </Link>
          ))}
        </div>
        {lookup.leagues.length === 0 ? (
          <p className="mt-6 text-muted">Sleeper returned no NFL leagues for {season}.</p>
        ) : (
          <ul className="mt-6 divide-y divide-line rounded-lg border border-line">
            {lookup.leagues.map((league) => (
              <li key={league.leagueId}>
                <Link className="block px-4 py-3" href={`/league/${league.leagueId}`}>
                  <span className="font-semibold">{league.name}</span>
                  <span className="mt-1 block text-sm text-muted">
                    {league.season} · {league.status}
                    {league.totalRosters ? ` · ${league.totalRosters} rosters` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
}
