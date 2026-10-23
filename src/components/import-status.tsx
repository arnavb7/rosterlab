"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type JobPayload = {
  status: string;
  stage: string;
  completedUnits: number;
  totalUnits: number | null;
  cacheHits: number;
  warnings: { level: string; message: string }[];
  error: string | null;
};

const STAGE_LABELS: Record<string, string> = {
  league: "League settings",
  users: "Managers",
  rosters: "Rosters",
  draft_list: "Draft list",
  draft_detail: "Draft picks",
  traded_picks: "Traded picks",
  matchups: "Matchups",
  transactions: "Transactions",
  players: "Player directory",
  history: "Prior seasons",
  done: "Finished",
};

export function ImportStatus({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [job, setJob] = useState<JobPayload | null>(null);
  const [queuedPolls, setQueuedPolls] = useState(0);

  useEffect(() => {
    let stopped = false;
    let previous = "";
    async function poll() {
      const response = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
      if (!response.ok) return;
      const body = (await response.json()) as JobPayload;
      if (stopped) return;
      setJob(body);
      if (body.status === "queued") setQueuedPolls((count) => count + 1);
      const token = `${body.status}:${body.completedUnits}:${body.stage}`;
      if (token !== previous) {
        previous = token;
        router.refresh();
      }
      if (body.status === "succeeded" || body.status === "partial" || body.status === "failed") {
        window.clearInterval(timer);
        router.refresh();
      }
    }
    const timer = window.setInterval(() => {
      void poll();
    }, 1500);
    void poll();
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [jobId, router]);

  if (!job) return <p className="text-sm text-muted">Checking import status…</p>;
  const stepLabel =
    job.totalUnits === null
      ? `${job.completedUnits} steps completed`
      : `${job.completedUnits} of ${job.totalUnits} steps`;

  return (
    <section className="rounded-lg border border-line bg-card p-4" aria-live="polite">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">Import</h2>
        <p className="font-mono text-sm text-muted">{stepLabel}</p>
      </div>
      <p className="mt-2 text-sm">
        {STAGE_LABELS[job.stage] ?? job.stage}
        <span className="ml-2 uppercase tracking-wide text-muted">{job.status}</span>
      </p>
      {job.cacheHits > 0 ? (
        <p className="mt-1 text-sm text-muted">{job.cacheHits} steps used a cached response.</p>
      ) : null}
      {job.status === "queued" && queuedPolls >= 2 ? (
        <p className="mt-2 text-sm text-amber">
          Waiting for the import worker. Start it with <code className="font-mono">pnpm worker</code>.
        </p>
      ) : null}
      {job.error ? <p className="mt-2 text-sm text-danger">{job.error}</p> : null}
      {Array.isArray(job.warnings) && job.warnings.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm text-muted">
          {job.warnings.slice(0, 8).map((warning, index) => (
            <li key={`${warning.message}-${index}`}>{warning.message}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
