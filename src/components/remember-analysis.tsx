"use client";

import { useEffect } from "react";

export function RememberAnalysis({
  leagueId,
  rosterId,
  leagueName,
  teamName,
  demo,
}: {
  leagueId: string;
  rosterId: number;
  leagueName: string;
  teamName: string;
  demo: boolean;
}) {
  useEffect(() => {
    localStorage.setItem(
      "tendencies.analysisContext",
      JSON.stringify({ leagueId, rosterId, leagueName, teamName, demo, savedAt: new Date().toISOString() }),
    );
  }, [demo, leagueId, leagueName, rosterId, teamName]);
  return null;
}
