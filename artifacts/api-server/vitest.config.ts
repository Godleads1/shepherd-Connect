import { defineConfig } from "vitest/config";

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
    // Provide dummy env vars so modules that require them at import time
    // don't throw before vi.mock() hoisting can replace them.
    env: {
      SESSION_SECRET: "test-secret-for-vitest",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      PORT: "8080",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts", "src/**/*.d.ts"],
    },
  },
});
