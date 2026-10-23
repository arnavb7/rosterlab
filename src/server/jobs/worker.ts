import { pathToFileURL } from "node:url";

import { executeImportJob, syncProviderRegistry } from "@/server/jobs/execute-job";
import { claimNextJob } from "@/server/jobs/queue";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function runWorkerLoop(options?: { once?: boolean }): Promise<void> {
  const workerId = `worker-${process.pid}`;
  await syncProviderRegistry();
  do {
    const job = await claimNextJob(workerId);
    if (!job) {
      if (options?.once) return;
      await sleep(1000);
      continue;
    }
    console.log(JSON.stringify({ workerId, jobId: job.id }));
    await executeImportJob(job.id);
    if (options?.once) return;
  } while (!options?.once);
}

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === entry) {
  runWorkerLoop().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Worker failed.");
    process.exit(1);
  });
}
