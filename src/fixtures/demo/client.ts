import { z } from "zod";

import { demoWorld } from "@/fixtures/demo/world";
import type { SleeperClient } from "@/server/providers/sleeper/client";
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
} from "@/server/providers/sleeper/schemas";

function list<T>(schema: z.ZodType<T>, value: unknown): T[] {
  return z.array(schema).parse(value ?? []);
}

export function createDemoClient(): SleeperClient {
  return {
    async getUser() {
      return null;
    },
    async getUserLeagues() {
      return [];
    },
    async getLeague(leagueId) {
      const league = demoWorld.leagues[leagueId as keyof typeof demoWorld.leagues];
      return league ? sleeperLeagueSchema.parse(league) : null;
    },
    async getLeagueUsers(leagueId) {
      return list(sleeperLeagueUserSchema, demoWorld.users[leagueId as keyof typeof demoWorld.users] ?? []);
    },
    async getRosters(leagueId) {
      return list(sleeperRosterSchema, demoWorld.rosters[leagueId as keyof typeof demoWorld.rosters] ?? []);
    },
    async getMatchups(leagueId, week) {
      return list(sleeperMatchupSchema, demoWorld.matchups[`${leagueId}:${week}`] ?? []);
    },
    async getTransactions(leagueId, week) {
      return list(sleeperTransactionSchema, demoWorld.transactions[`${leagueId}:${week}`] ?? []);
    },
    async getLeagueDrafts(leagueId) {
      return list(sleeperDraftSchema, demoWorld.drafts[leagueId as keyof typeof demoWorld.drafts] ?? []);
    },
    async getDraft(draftId) {
      const draft = demoWorld.draftDetails[draftId];
      return draft ? sleeperDraftSchema.parse(draft) : null;
    },
    async getDraftPicks(draftId) {
      return list(sleeperDraftPickSchema, demoWorld.picks[draftId as keyof typeof demoWorld.picks] ?? []);
    },
    async getLeagueTradedPicks(leagueId) {
      return list(sleeperTradedPickSchema, demoWorld.tradedPicks[leagueId as keyof typeof demoWorld.tradedPicks] ?? []);
    },
    async getNflState() {
      return sleeperNflStateSchema.parse(demoWorld.state);
    },
    async getPlayersNfl() {
      return demoWorld.players;
    },
    async getTrending() {
      return [];
    },
  };
}
