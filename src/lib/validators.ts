import { z } from "zod";

export const sleeperLeagueIdSchema = z.string().regex(/^\d{1,30}$/);
export const demoLeagueIdSchema = z.string().regex(/^demo-[a-z0-9-]{1,48}$/);
export const leagueIdSchema = z.union([sleeperLeagueIdSchema, demoLeagueIdSchema]);
export const usernameSchema = z.string().regex(/^[A-Za-z0-9_]{1,40}$/);
export const seasonSchema = z.string().regex(/^20\d{2}$/);
export const rosterIdSchema = z.number().int().min(1).max(500);
export const jobIdSchema = z.string().regex(/^c[a-z0-9]{8,}$/);

export function isDemoLeagueId(leagueId: string): boolean {
  return leagueId.startsWith("demo-");
}
