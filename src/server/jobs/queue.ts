import { Prisma } from "@prisma/client";

import { initialCursor, type ImportCursor } from "@/domain/normalized";
import { prisma } from "@/lib/db";
import { isDemoLeagueId } from "@/lib/validators";

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function assertJobProvider(job: { isDemo: boolean; externalLeagueId: string }): void {
  if (job.isDemo !== isDemoLeagueId(job.externalLeagueId)) {
    throw new Error(
      job.isDemo
        ? "Demo jobs can only import demo leagues."
        : "Demo leagues are not requested from Sleeper.",
    );
  }
}

export async function enqueueLeagueImport(input: {
  leagueId: string;
  isDemo: boolean;
  correction?: boolean;
}): Promise<{ id: string; status: string }> {
  assertJobProvider({ isDemo: input.isDemo, externalLeagueId: input.leagueId });
  const correction = input.correction ?? false;
  const existing = await prisma.importJob.findFirst({
    where: {
      externalLeagueId: input.leagueId,
      isDemo: input.isDemo,
      correction,
      status: { in: ["queued", "running"] },
    },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return { id: existing.id, status: existing.status };
  const cursor = initialCursor(input.leagueId);
  const job = await prisma.importJob.create({
    data: {
      kind: "league_import",
      status: "queued",
      externalLeagueId: input.leagueId,
      isDemo: input.isDemo,
      correction,
      stage: cursor.stage,
      cursor: json(cursor),
      warnings: [],
    },
  });
  return { id: job.id, status: job.status };
}

export async function claimNextJob(workerId: string): Promise<{ id: string } | null> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    WITH next_job AS (
      SELECT id
      FROM "ImportJob"
      WHERE (
        status = 'queued'
        AND ("retryAt" IS NULL OR "retryAt" <= NOW())
      ) OR (
        status = 'running'
        AND "lockedAt" IS NOT NULL
        AND "lockedAt" < NOW() - INTERVAL '5 minutes'
      )
      ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE "ImportJob" AS job
    SET
      status = 'running',
      "lockedBy" = ${workerId},
      "lockedAt" = NOW(),
      "startedAt" = COALESCE(job."startedAt", NOW()),
      "attemptCount" = job."attemptCount" + 1,
      "updatedAt" = NOW()
    FROM next_job
    WHERE job.id = next_job.id
    RETURNING job.id
  `;
  return rows[0] ?? null;
}

export function readCursor(value: unknown, leagueId: string): ImportCursor {
  if (!value || typeof value !== "object") return initialCursor(leagueId);
  const cursor = value as ImportCursor;
  if (cursor.version !== 1 || typeof cursor.stage !== "string" || !Array.isArray(cursor.leagueQueue)) {
    return initialCursor(leagueId);
  }
  return cursor;
}
