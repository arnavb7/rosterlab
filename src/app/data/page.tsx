import { Suspense } from "react";
import { connection } from "next/server";

import { providerRegistry } from "@/domain/features";
import { prisma } from "@/lib/db";

export default function DataPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading provider status…</p>}>
      <DataContent />
    </Suspense>
  );
}

async function DataContent() {
  await connection();
  let recorded = false;
  try {
    recorded = (await prisma.providerCapability.count()) > 0;
  } catch {
    recorded = false;
  }
  return (
    <div>
      <h1 className="text-3xl font-semibold">Data and settings</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Feature availability comes from this provider registry. The page below is the application copy.
        {recorded
          ? " The worker has also recorded it in the database."
          : " The database does not have a recorded copy until the worker starts."}
      </p>
      <ul className="mt-6 space-y-4">
        {providerRegistry.map((provider) => (
          <li key={provider.id} className="rounded-lg border border-line p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold">{provider.displayName}</h2>
              <p className={provider.operationalStatus === "available" ? "text-sm text-teal" : "text-sm text-amber"}>
                {provider.operationalStatus === "available" ? "Available" : "Not configured"}
              </p>
            </div>
            <p className="mt-2 text-sm text-muted">{provider.licenseNotes}</p>
            <p className="mt-2 text-sm">{provider.updateFrequency}</p>
            <p className="mt-2 text-sm text-muted">{provider.supportedSeasons}</p>
            {provider.availableMetrics.length > 0 ? (
              <p className="mt-2 font-mono text-xs text-muted">{provider.availableMetrics.join(" · ")}</p>
            ) : null}
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
              {provider.limitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
