import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    env: {
      DATABASE_URL: "postgresql://tendencies:tendencies@localhost:5433/tendencies",
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
