import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    env: {
      DATABASE_URL: "postgresql://tendencies:tendencies@localhost:5433/tendencies",
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
