import { defineConfig } from "vitest/config";

const fallbackDatabaseEnv = process.env.DATABASE_URL
  ? {}
  : { DATABASE_URL: "postgresql://test:test@localhost:5432/test" };

export default defineConfig({
  test: {
    // Only run the mocked unit/smoke tests by default.
    // src/tests/ are integration tests that require a live dev database
    // and should be run manually against the running app.
    include: ["src/__tests__/**/*.test.ts"],
    globals: true,
    environment: "node",
    testTimeout: 15000,
    hookTimeout: 15000,
    reporters: ["verbose"],
    // Keep ordinary no-database unit environments importable, but never
    // override Replit's provisioned development database connection.
    env: {
      SESSION_SECRET: "test-secret-for-vitest",
      PORT: "8080",
      ...fallbackDatabaseEnv,
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts", "src/**/*.d.ts"],
    },
  },
});
