import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

function withExplicitSslVerification(connectionString: string): string {
  const url = new URL(connectionString);
  const sslMode = url.searchParams.get("sslmode");

  // pg currently treats these modes as verify-full, but its next major version
  // will weaken that behavior. Preserve certificate and hostname verification
  // explicitly instead of relying on the compatibility alias.
  if (sslMode === "prefer" || sslMode === "require" || sslMode === "verify-ca") {
    url.searchParams.set("sslmode", "verify-full");
  }

  return url.toString();
}

const isProduction = process.env.NODE_ENV === "production";

export const pool = new Pool({
  connectionString: withExplicitSslVerification(process.env.DATABASE_URL),
  connectionTimeoutMillis: 8000,
  idleTimeoutMillis: 30000,
  max: isProduction ? 10 : 25,
  min: isProduction ? 0 : 2,
});

// Prevent unhandled 'error' events on idle connections from crashing the
// process. pg Pool emits 'error' when a kept-alive connection is dropped;
// without a listener Node.js treats it as an uncaught exception and exits.
pool.on("error", (err) => {
  const code = (err as Error & { code?: string }).code;
  if (code === "57P01") {
    console.warn("pg pool connection rotated by database administrator");
    return;
  }
  console.error("pg pool error:", err.message);
});

export const db = drizzle(pool, { schema });

export * from "./schema";
