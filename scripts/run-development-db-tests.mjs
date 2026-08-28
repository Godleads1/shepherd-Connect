import { spawnSync } from "node:child_process";

function fail(message) {
  console.error(`Development database test gate refused to run: ${message}`);
  process.exit(1);
}

if (process.env.REPLIT_DEPLOYMENT === "1" || process.env.NODE_ENV === "production") {
  fail("production execution is not allowed");
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  fail("DATABASE_URL is unavailable");
}

let databaseUrl;
try {
  databaseUrl = new URL(connectionString);
} catch {
  fail("DATABASE_URL is invalid");
}

if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol)) {
  fail("DATABASE_URL is not PostgreSQL");
}

if (["localhost", "127.0.0.1", "::1"].includes(databaseUrl.hostname)) {
  fail("DATABASE_URL resolves to the unavailable local PostgreSQL sidecar");
}

const result = spawnSync(
  "pnpm",
  ["exec", "vitest", "run", "--reporter=verbose"],
  {
    cwd: new URL("../artifacts/api-server/", import.meta.url),
    env: {
      ...process.env,
      RUN_DATABASE_ATTENDANCE_TESTS: "true",
      RUN_DATABASE_OTP_TESTS: "true",
      RUN_DATABASE_ROLE_TESTS: "true",
    },
    stdio: "inherit",
  },
);

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);