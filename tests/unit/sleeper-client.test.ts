import { describe, expect, it } from "vitest";

import { RequestGate } from "@/server/http/request-gate";
import { buildSleeperUrl, createSleeperHttpClient } from "@/server/providers/sleeper/client";

const state = { week: 7, leg: 7, season: "2026", season_type: "regular" };

describe("Sleeper HTTP client", () => {
  it("builds only allowlisted Sleeper URLs", () => {
    expect(buildSleeperUrl(["user", "sleeper"]).href).toBe("https://api.sleeper.app/v1/user/sleeper");
    expect(() => buildSleeperUrl([".."])).toThrow(/Invalid Sleeper path/);
    expect(() => buildSleeperUrl(["https://evil.example"])).toThrow(/Invalid Sleeper path/);
  });

  it("returns null for a null user and drops private fields", async () => {
    const client = createSleeperHttpClient({
      gate: new RequestGate(0, 2),
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.endsWith("/missing")) return Response.json(null);
        return Response.json({
          user_id: "42",
          username: "rowan",
          display_name: "Rowan",
          avatar: null,
          email: "secret@example.com",
          token: "secret-token",
        });
      },
    });
    expect(await client.getUser("missing")).toBeNull();
    const user = await client.getUser("rowan");
    expect(user).toMatchObject({ user_id: "42", username: "rowan" });
    expect(JSON.stringify(user)).not.toContain("secret");
  });

  it("retries 429 responses using Retry-After", async () => {
    const sleeps: number[] = [];
    let attempts = 0;
    const client = createSleeperHttpClient({
      maxRetries: 4,
      gate: new RequestGate(0, 1),
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      fetchImpl: async () => {
        attempts += 1;
        if (attempts < 3) return new Response("{}", { status: 429, headers: { "retry-after": "2" } });
        return Response.json(state);
      },
    });
    await expect(client.getNflState()).resolves.toMatchObject({ season: "2026" });
    expect(sleeps).toEqual([2000, 2000]);
  });

  it("shares one in-flight request for the same URL", async () => {
    let calls = 0;
    const client = createSleeperHttpClient({
      gate: new RequestGate(0, 4),
      fetchImpl: async () => {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return Response.json(state);
      },
    });
    await Promise.all([client.getNflState(), client.getNflState()]);
    expect(calls).toBe(1);
  });

  it("does not request demo league ids from Sleeper", async () => {
    const client = createSleeperHttpClient({
      gate: new RequestGate(0, 1),
      fetchImpl: async () => {
        throw new Error("network should not be called");
      },
    });
    await expect(client.getLeague("demo-northwind")).rejects.toThrow(/Invalid league id/);
  });
});

describe("request gate", () => {
  it("waits for the minimum interval", async () => {
    let clock = 1_000;
    const sleeps: number[] = [];
    const gate = new RequestGate(
      100,
      1,
      () => clock,
      async (ms) => {
        sleeps.push(ms);
        clock += ms;
      },
    );
    await gate.acquire();
    gate.release();
    await gate.acquire();
    gate.release();
    expect(sleeps).toEqual([100]);
  });
});
