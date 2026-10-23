import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { NormalizedPlayer } from "@/domain/normalized";
import { PLAYER_DIRECTORY_TTL_MS } from "@/domain/cache-policy";
import { sleeperPlayerSchema } from "@/server/providers/sleeper/schemas";

export type DirectoryLookup = {
  players: Map<string, NormalizedPlayer>;
  fetchedAt: string | null;
  cache: "hit" | "miss" | "unavailable" | "stale";
  unavailable: boolean;
};

type DirectoryFile = {
  fetchedAt: string;
  players: Record<string, unknown>;
};

export class FilePlayerDirectory {
  constructor(
    private readonly deps: {
      read: () => Promise<DirectoryFile | null>;
      write: (file: DirectoryFile) => Promise<void>;
      download: () => Promise<Record<string, unknown>>;
      now: Date;
      ttlMs: number;
      source: NormalizedPlayer["source"];
    },
  ) {}

  async lookup(ids: readonly string[]): Promise<DirectoryLookup> {
    let file = await this.deps.read();
    const age = file ? this.deps.now.getTime() - Date.parse(file.fetchedAt) : Number.POSITIVE_INFINITY;
    let cache: DirectoryLookup["cache"] = file && age < this.deps.ttlMs ? "hit" : "miss";
    if (!file || age >= this.deps.ttlMs) {
      try {
        const players = await this.deps.download();
        file = { fetchedAt: this.deps.now.toISOString(), players };
        await this.deps.write(file);
        cache = "miss";
      } catch {
        if (!file) {
          return { players: new Map(), fetchedAt: null, cache: "unavailable", unavailable: true };
        }
        cache = "stale";
      }
    }

    const found = new Map<string, NormalizedPlayer>();
    for (const id of ids) {
      const player = normalizeDirectoryPlayer(id, file.players[id], this.deps.source);
      if (player) found.set(id, player);
    }
    return {
      players: found,
      fetchedAt: file.fetchedAt,
      cache,
      unavailable: false,
    };
  }
}

export function normalizeDirectoryPlayer(
  id: string,
  raw: unknown,
  source: NormalizedPlayer["source"],
): NormalizedPlayer | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const parsed = sleeperPlayerSchema.safeParse(raw);
  if (!parsed.success) return null;
  const player = parsed.data;
  const firstName = player.first_name ?? null;
  const lastName = player.last_name ?? null;
  const combined = [firstName, lastName].filter(Boolean).join(" ");
  return {
    sleeperId: id,
    firstName,
    lastName,
    fullName: player.full_name ?? (combined || null),
    position: player.position ?? null,
    fantasyPositions: player.fantasy_positions ?? [],
    team: player.team ?? null,
    status: player.status ?? null,
    injuryStatus: player.injury_status ?? null,
    searchRank: typeof player.search_rank === "number" ? player.search_rank : null,
    source,
  };
}

export function createDiskPlayerDirectory(input: {
  fileName: string;
  download: () => Promise<Record<string, unknown>>;
  now: Date;
  source: NormalizedPlayer["source"];
}): FilePlayerDirectory {
  const directory = process.env.PLAYER_CACHE_DIR ?? path.join(process.cwd(), ".cache", "sleeper");
  const filePath = path.join(directory, input.fileName);
  const ttlHours = Number(process.env.PLAYER_DIRECTORY_TTL_HOURS ?? 24);
  return new FilePlayerDirectory({
    source: input.source,
    now: input.now,
    ttlMs: Number.isFinite(ttlHours) ? ttlHours * 60 * 60 * 1000 : PLAYER_DIRECTORY_TTL_MS,
    download: input.download,
    async read() {
      try {
        const text = await readFile(filePath, "utf8");
        const parsed = JSON.parse(text) as DirectoryFile;
        if (!parsed || typeof parsed.fetchedAt !== "string" || !parsed.players) return null;
        return parsed;
      } catch {
        return null;
      }
    },
    async write(file) {
      await mkdir(directory, { recursive: true });
      await writeFile(filePath, JSON.stringify(file));
    },
  });
}
