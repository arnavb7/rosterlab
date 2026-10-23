"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { leagueIdSchema, rosterIdSchema } from "@/lib/validators";
import { consumeRateLimit } from "@/server/http/rate-limit";
import { enqueueLeagueImport } from "@/server/jobs/queue";

async function clientKey(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for") ?? "local";
  return forwarded.split(",")[0]?.trim().slice(0, 80) || "local";
}

export async function startAnalysis(formData: FormData): Promise<void> {
  const leagueId = String(formData.get("leagueId") ?? "");
  const rosterId = Number(formData.get("rosterId"));
  const correction = formData.get("correction") === "1";
  const parsedLeague = leagueIdSchema.safeParse(leagueId);
  const parsedRoster = rosterIdSchema.safeParse(rosterId);
  if (!parsedLeague.success || !parsedRoster.success) {
    redirect("/?error=invalid");
  }
  const key = await clientKey();
  if (!consumeRateLimit(`import:${key}`, 20, 10 * 60 * 1000)) {
    redirect(`/league/${parsedLeague.data}?error=rate`);
  }
  const job = await enqueueLeagueImport({
    leagueId: parsedLeague.data,
    isDemo: parsedLeague.data.startsWith("demo-"),
    correction,
  });
  redirect(`/league/${parsedLeague.data}/team/${parsedRoster.data}?job=${job.id}`);
}
