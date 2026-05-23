import assert from "node:assert/strict";
import test from "node:test";

import { databaseConfigFromEnv } from "../src/database.ts";

test("reads the PostgreSQL connection string from DATABASE_URL", () => {
  const config = databaseConfigFromEnv({
    DATABASE_URL: "postgresql://user:password@ep-example.neon.tech/neondb?sslmode=require"
  });

  assert.equal(config.connectionString, "postgresql://user:password@ep-example.neon.tech/neondb?sslmode=require");
  assert.deepEqual(config.ssl, { rejectUnauthorized: false });
});

test("requires DATABASE_URL", () => {
  assert.throws(() => databaseConfigFromEnv({}), /DATABASE_URL is required/);
});
