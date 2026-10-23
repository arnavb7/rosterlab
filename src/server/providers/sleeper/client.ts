import { z } from "zod";

import { ProviderError } from "@/server/providers/errors";
import { RequestGate } from "@/server/http/request-gate";
import {
  sleeperDraftPickSchema,
  sleeperDraftSchema,
  sleeperLeagueSchema,
  sleeperLeagueUserSchema,
  sleeperMatchupSchema,
  sleeperNflStateSchema,
  sleeperRosterSchema,
  sleeperTradedPickSchema,
  sleeperTransactionSchema,
  sleeperTrendingSchema,
  sleeperUserSchema,
  type SleeperDraft,
  type SleeperDraftPick,
  type SleeperLeague,
  type SleeperLeagueUser,
  type SleeperMatchup,
  type SleeperNflState,
  type SleeperRoster,
  type SleeperTradedPick,
  type SleeperTransaction,
  type SleeperUser,
} from "@/server/providers/sleeper/schemas";

const SLEEPER_ORIGIN = "https://api.sleeper.app";
const SLEEPER_PREFIX = "/v1";

export type SleeperClient = {
  getUser(identifier: string): Promise<SleeperUser | null>;
  getUserLeagues(userId: string, season: string): Promise<SleeperLeague[]>;
  getLeague(leagueId: string): Promise<SleeperLeague | null>;
  getLeagueUsers(leagueId: string): Promise<SleeperLeagueUser[]>;
  getRosters(leagueId: string): Promise<SleeperRoster[]>;
  getMatchups(leagueId: string, week: number): Promise<SleeperMatchup[]>;
  getTransactions(leagueId: string, week: number): Promise<SleeperTransaction[]>;
  getLeagueDrafts(leagueId: string): Promise<SleeperDraft[]>;
  getDraft(draftId: string): Promise<SleeperDraft | null>;
  getDraftPicks(draftId: string): Promise<SleeperDraftPick[]>;
  getLeagueTradedPicks(leagueId: string): Promise<SleeperTradedPick[]>;
  getNflState(): Promise<SleeperNflState>;
  getPlayersNfl(): Promise<Record<string, unknown>>;
  getTrending(type: "add" | "drop"): Promise<{ player_id: string; count: number }[]>;
};

export function buildSleeperUrl(segments: readonly string[]): URL {
  if (segments.length === 0 || segments.some((segment) => !/^[A-Za-z0-9_]{1,40}$/.test(segment))) {
    throw new ProviderError("Invalid Sleeper path.", false, "bad_path");
  }
  const url = new URL(SLEEPER_ORIGIN);
  if (url.protocol !== "https:" || url.hostname !== "api.sleeper.app") {
    throw new ProviderError("Sleeper host is not allowlisted.", false, "bad_host");
  }
  url.pathname = `${SLEEPER_PREFIX}/${segments.join("/")}`;
  return url;
}

type FetchResponse = {
  status: number;
  body: unknown;
  retryAfterMs: number | null;
};

export function createSleeperHttpClient(options?: {
  fetchImpl?: typeof fetch;
  gate?: RequestGate;
  sleep?: (ms: number) => Promise<void>;
  maxRetries?: number;
}): SleeperClient {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const gate =
    options?.gate ??
    new RequestGate(
      Number(process.env.SLEEPER_MIN_INTERVAL_MS ?? 120),
      Number(process.env.SLEEPER_MAX_CONCURRENCY ?? 4),
    );
  const sleep =
    options?.sleep ??
    ((ms: number) =>
      new Promise((resolve) => {
        setTimeout(resolve, ms);
      }));
  const maxRetries = options?.maxRetries ?? Number(process.env.SLEEPER_MAX_RETRIES ?? 4);
  const inflight = new Map<string, Promise<unknown>>();

  async function requestOnce(url: string): Promise<unknown> {
    let lastError: ProviderError | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      await gate.acquire();
      let response: FetchResponse;
      try {
        response = await readResponse(await fetchImpl(url, { cache: "no-store" }));
      } catch (error) {
        if (error instanceof ProviderError && !error.retryable) throw error;
        lastError =
          error instanceof ProviderError
            ? error
            : new ProviderError(error instanceof Error ? error.message : "Sleeper request failed.", true, "network");
        response = { status: 0, body: null, retryAfterMs: null };
      } finally {
        gate.release();
      }

      if (response.status === 200) return response.body;
      if (response.status === 404) {
        throw new ProviderError("Sleeper returned 404.", false, "not_found");
      }
      const retryable = response.status === 429 || response.status >= 500 || response.status === 0;
      lastError = new ProviderError(
        `Sleeper returned HTTP ${response.status || "network"}.`,
        retryable,
        response.status === 429 ? "rate_limit" : "upstream",
      );
      if (!retryable || attempt === maxRetries) throw lastError;
      const delay = response.retryAfterMs ?? Math.min(300 * 2 ** attempt, 5000);
      await sleep(delay);
    }
    throw lastError ?? new ProviderError("Sleeper request failed.", true, "upstream");
  }

  function request(segments: string[]): Promise<unknown> {
    const url = buildSleeperUrl(segments).toString();
    const existing = inflight.get(url);
    if (existing) return existing;
    const promise = requestOnce(url).finally(() => {
      inflight.delete(url);
    });
    inflight.set(url, promise);
    return promise;
  }

  function assertSleeperId(value: string, label: string): void {
    if (!/^[A-Za-z0-9_]{1,40}$/.test(value)) {
      throw new ProviderError(`Invalid ${label}.`, false, "bad_id");
    }
  }

  return {
    async getUser(identifier) {
      assertSleeperId(identifier, "username");
      const body = await request(["user", identifier]);
      if (body === null) return null;
      return parseOne(sleeperUserSchema, body, "user");
    },
    async getUserLeagues(userId, season) {
      assertSleeperId(userId, "user id");
      if (!/^20\d{2}$/.test(season)) throw new ProviderError("Invalid season.", false, "bad_id");
      const body = await request(["user", userId, "leagues", "nfl", season]);
      if (body === null) return [];
      return parseList(sleeperLeagueSchema, body, "leagues");
    },
    async getLeague(leagueId) {
      assertSleeperId(leagueId, "league id");
      try {
        const body = await request(["league", leagueId]);
        if (body === null) return null;
        return parseOne(sleeperLeagueSchema, body, "league");
      } catch (error) {
        if (error instanceof ProviderError && error.code === "not_found") return null;
        throw error;
      }
    },
    async getLeagueUsers(leagueId) {
      assertSleeperId(leagueId, "league id");
      return parseList(sleeperLeagueUserSchema, await request(["league", leagueId, "users"]), "users");
    },
    async getRosters(leagueId) {
      assertSleeperId(leagueId, "league id");
      return parseList(sleeperRosterSchema, await request(["league", leagueId, "rosters"]), "rosters");
    },
    async getMatchups(leagueId, week) {
      assertSleeperId(leagueId, "league id");
      assertWeek(week);
      return parseList(sleeperMatchupSchema, await request(["league", leagueId, "matchups", String(week)]), "matchups");
    },
    async getTransactions(leagueId, week) {
      assertSleeperId(leagueId, "league id");
      assertWeek(week);
      return parseList(
        sleeperTransactionSchema,
        await request(["league", leagueId, "transactions", String(week)]),
        "transactions",
      );
    },
    async getLeagueDrafts(leagueId) {
      assertSleeperId(leagueId, "league id");
      return parseList(sleeperDraftSchema, await request(["league", leagueId, "drafts"]), "drafts");
    },
    async getDraft(draftId) {
      assertSleeperId(draftId, "draft id");
      try {
        const body = await request(["draft", draftId]);
        if (body === null) return null;
        return parseOne(sleeperDraftSchema, body, "draft");
      } catch (error) {
        if (error instanceof ProviderError && error.code === "not_found") return null;
        throw error;
      }
    },
    async getDraftPicks(draftId) {
      assertSleeperId(draftId, "draft id");
      return parseList(sleeperDraftPickSchema, await request(["draft", draftId, "picks"]), "draft picks");
    },
    async getLeagueTradedPicks(leagueId) {
      assertSleeperId(leagueId, "league id");
      return parseList(sleeperTradedPickSchema, await request(["league", leagueId, "traded_picks"]), "traded picks");
    },
    async getNflState() {
      const body = await request(["state", "nfl"]);
      if (body === null) throw new ProviderError("NFL state returned null.", true, "null_body");
      return parseOne(sleeperNflStateSchema, body, "nfl state");
    },
    async getPlayersNfl() {
      const body = await request(["players", "nfl"]);
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw new ProviderError("Player directory was not an object.", true, "schema");
      }
      return body as Record<string, unknown>;
    },
    async getTrending(type) {
      if (type !== "add" && type !== "drop") {
        throw new ProviderError("Invalid trending type.", false, "bad_path");
      }
      return parseList(sleeperTrendingSchema, await request(["players", "nfl", "trending", type]), "trending");
    },
  };
}

function assertWeek(week: number): void {
  if (!Number.isInteger(week) || week < 1 || week > 30) {
    throw new ProviderError("Invalid week.", false, "bad_id");
  }
}

async function readResponse(response: Response): Promise<FetchResponse> {
  const retryAfter = response.headers.get("retry-after");
  const retryAfterSeconds = retryAfter ? Number(retryAfter) : NaN;
  const text = await response.text();
  let body: unknown = null;
  if (text !== "") {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      throw new ProviderError("Sleeper returned invalid JSON.", true, "schema");
    }
  }
  return {
    status: response.status,
    body,
    retryAfterMs: Number.isFinite(retryAfterSeconds) ? retryAfterSeconds * 1000 : null,
  };
}

function parseOne<T>(schema: z.ZodType<T>, body: unknown, resource: string): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ProviderError(`${resource} did not match the expected shape.`, false, "schema");
  }
  return parsed.data;
}

function parseList<T>(schema: z.ZodType<T>, body: unknown, resource: string): T[] {
  if (body === null) throw new ProviderError(`${resource} returned null.`, false, "null_body");
  const parsed = z.array(schema).safeParse(body);
  if (!parsed.success) {
    throw new ProviderError(`${resource} did not match the expected shape.`, false, "schema");
  }
  return parsed.data;
}

let httpClient: SleeperClient | null = null;

export function getSleeperHttpClient(): SleeperClient {
  httpClient ??= createSleeperHttpClient();
  return httpClient;
}
