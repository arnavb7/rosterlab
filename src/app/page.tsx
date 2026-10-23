import Link from "next/link";
import { Suspense } from "react";

import { ContinueAnalysis } from "@/components/continue-analysis";

export default function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
      <section>
        <p className="text-sm uppercase tracking-[0.18em] text-teal">Sleeper league analysis</p>
        <h1 className="mt-2 max-w-xl text-4xl font-semibold tracking-tight">Know the habits. Then look at the roster.</h1>
        <p className="mt-4 max-w-xl text-muted">
          Tendencies reads publicly available Sleeper league data. Entering a username does not verify that you control
          the team and does not sign you in.
        </p>
        <ContinueAnalysis />
        <Suspense>
          <HomeError searchParams={searchParams} />
        </Suspense>
      </section>
      <div className="space-y-4">
        <form action="/league/go" className="rounded-lg border border-line bg-card p-4">
          <h2 className="font-semibold">Analyze by league ID</h2>
          <label className="mt-3 block text-sm text-muted" htmlFor="leagueId">
            Sleeper league ID
          </label>
          <input
            id="leagueId"
            name="leagueId"
            required
            pattern="\d{1,30}"
            className="mt-1 w-full rounded-md border border-line bg-background px-3 py-2"
          />
          <button className="mt-3 rounded-md bg-teal px-3 py-2 text-sm font-semibold text-background" type="submit">
            Resolve league
          </button>
        </form>
        <form action="/lookup/go" className="rounded-lg border border-line bg-card p-4">
          <h2 className="font-semibold">Analyze by username</h2>
          <label className="mt-3 block text-sm text-muted" htmlFor="username">
            Sleeper username
          </label>
          <input
            id="username"
            name="username"
            required
            pattern="[A-Za-z0-9_]{1,40}"
            className="mt-1 w-full rounded-md border border-line bg-background px-3 py-2"
          />
          <button className="mt-3 rounded-md border border-line px-3 py-2 text-sm" type="submit">
            Find leagues
          </button>
        </form>
        <p className="text-sm">
          <Link className="text-teal" href="/league/demo-northwind">
            Explore the fictional Northwind demo
          </Link>
        </p>
      </div>
    </div>
  );
}

async function HomeError({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  if (params.error !== "invalid") return null;
  return <p className="mt-4 text-sm text-danger">Enter a numeric league ID or a username with letters, numbers, and underscores.</p>;
}
