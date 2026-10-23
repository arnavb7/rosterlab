import { NextResponse } from "next/server";

import { sleeperLeagueIdSchema } from "@/lib/validators";

export async function GET(request: Request) {
  const leagueId = new URL(request.url).searchParams.get("leagueId") ?? "";
  if (!sleeperLeagueIdSchema.safeParse(leagueId).success) {
    return NextResponse.redirect(new URL("/?error=invalid", request.url));
  }
  return NextResponse.redirect(new URL(`/league/${leagueId}`, request.url));
}
