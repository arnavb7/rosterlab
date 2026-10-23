import { loadEnvFile } from "node:process";

import { PrismaClient } from "@prisma/client";

try {
  loadEnvFile();
} catch {
  // Hosts and tests can provide DATABASE_URL without a local .env file.
}

const globalForPrisma = globalThis as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
