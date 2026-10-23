"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

type Saved = {
  leagueId: string;
  rosterId: number;
  leagueName: string;
  teamName: string;
  demo: boolean;
};

const STORAGE_KEY = "tendencies.analysisContext";
let cachedRaw: string | null = null;
let cachedValue: Saved | null = null;

function readSaved(): Saved | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  if (!raw) {
    cachedValue = null;
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Saved;
    cachedValue = parsed.leagueId && parsed.rosterId ? parsed : null;
  } catch {
    cachedValue = null;
  }
  return cachedValue;
}

export function ContinueAnalysis() {
  const saved = useSyncExternalStore(
    () => () => {},
    readSaved,
    () => null,
  );
  if (!saved) return null;
  return (
    <p className="mt-6 text-sm">
      <Link className="text-teal underline-offset-2 hover:underline" href={`/league/${saved.leagueId}/team/${saved.rosterId}`}>
        Continue {saved.demo ? "demo " : ""}
        {saved.teamName || saved.leagueName}
      </Link>
    </p>
  );
}
