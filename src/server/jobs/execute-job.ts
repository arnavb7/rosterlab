import { Prisma } from "@prisma/client";

import { providerRegistry } from "@/domain/features";
import { prisma } from "@/lib/db";
import { createDemoClient } from "@/fixtures/demo/client";
import { runLeagueImport } from "@/server/ingestion/import-league";
import { createPrismaImportStore } from "@/server/ingestion/prisma-store";
import { createDiskPlayerDirectory } from "@/server/players/directory";
import { isRetryableProviderError } from "@/server/providers/errors";
import { getSleeperHttpClient } from "@/server/providers/sleeper/client";
import { assertJobProvider, readCursor } from "@/server/jobs/queue";

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function historyLimit(): number {
  const value = Number(process.env.IMPORT_HISTORY_LIMIT ?? 3);
  if (!Number.isInteger(value) || value < 0 || value > 20) return 3;
  return value;
}

export async function syncProviderRegistry(): Promise<void> {
  for (const provider of providerRegistry) {
    await prisma.providerCapability.upsert({
      where: { id: provider.id },
      create: {
        id: provider.id,
        displayName: provider.displayName,
        availableMetrics: provider.availableMetrics,
        supportedSeasons: provider.supportedSeasons,
        latestDataTimestamp: provider.latestDataTimestamp ? new Date(provider.latestDataTimestamp) : null,
        updateFrequency: provider.updateFrequency,
        licenseNotes: provider.licenseNotes,
        operationalStatus: provider.operationalStatus,
        limitations: provider.limitations,
      },
      update: {
        displayName: provider.displayName,
        availableMetrics: provider.availableMetrics,
        supportedSeasons: provider.supportedSeasons,
        updateFrequency: provider.updateFrequency,
        licenseNotes: provider.licenseNotes,
        operationalStatus: provider.operationalStatus,
        limitations: provider.limitations,
      },
    });
  }
}

export async function executeImportJob(jobId: string): Promise<void> {
  const job = await prisma.importJob.findUnique({ where: { id: jobId } });
  if (!job || (job.status !== "running" && job.status !== "queued")) return;
  assertJobProvider(job);
  const now = new Date();
  const client = job.isDemo ? createDemoClient() : getSleeperHttpClient();
  const directory = createDiskPlayerDirectory({
    fileName: job.isDemo ? "players-demo.json" : "players-nfl.json",
    download: () => client.getPlayersNfl(),
    now,
    source: job.isDemo ? "demo" : "sleeper",
  });
  try {
    const result = await runLeagueImport({
      rootLeagueId: job.externalLeagueId,
      isDemo: job.isDemo,
      correction: job.correction,
      historyLimit: historyLimit(),
      now,
      client,
      store: createPrismaImportStore(),
      directory,
      cursor: readCursor(job.cursor, job.externalLeagueId),
      onProgress: async (cursor) => {
        await prisma.importJob.update({
          where: { id: job.id },
          data: {
            stage: cursor.stage,
            completedUnits: cursor.completedUnits,
            totalUnits: cursor.totalUnits,
            cacheHits: cursor.cacheHits,
            cursor: json(cursor),
            warnings: json(cursor.notices),
          },
        });
      },
    });
    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: result.status,
        stage: "done",
        finishedAt: new Date(),
        lockedBy: null,
        error: null,
        cursor: json(result.cursor),
        warnings: json(result.cursor.notices),
        completedUnits: result.cursor.completedUnits,
        totalUnits: result.cursor.totalUnits,
        cacheHits: result.cursor.cacheHits,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed.";
    const attempts = job.attemptCount;
    if (isRetryableProviderError(error) && attempts < 5) {
      await prisma.importJob.update({
        where: { id: job.id },
        data: {
          status: "queued",
          retryAt: new Date(Date.now() + Math.min(30_000, 1000 * 2 ** attempts)),
          error: message,
          lockedBy: null,
        },
      });
      return;
    }
    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        error: message,
        finishedAt: new Date(),
        lockedBy: null,
      },
    });
  }
}
