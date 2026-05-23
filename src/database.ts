/// <reference types="node" />

import { config } from "dotenv";
import { Pool, type PoolConfig, type QueryResult, type QueryResultRow } from "pg";

config({ quiet: true });

let pool: Pool | null = null;

export function databaseConfigFromEnv(env: NodeJS.ProcessEnv = process.env): PoolConfig {
  const connectionString = env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required. Set it in Render or in a local .env file.");
  }

  return {
    connectionString,
    ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : false
  };
}

export function getDatabasePool(): Pool {
  if (!pool) {
    pool = new Pool(databaseConfigFromEnv());
  }

  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  return getDatabasePool().query<T>(text, params);
}

function shouldUseSsl(connectionString: string): boolean {
  try {
    const url = new URL(connectionString);
    return !["localhost", "127.0.0.1"].includes(url.hostname);
  } catch {
    return true;
  }
}
