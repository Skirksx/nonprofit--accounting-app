/// <reference types="node" />

import { createServer, type IncomingMessage } from "node:http";
import type { Pool, PoolClient, QueryResultRow } from "pg";

import { getAccountRegister, getAccountRegisterCsv } from "./accountRegisterReport.ts";
import { getDatabasePool } from "./database.ts";
import worker from "./index.ts";
import type { Env } from "./types.ts";

type PgExecutor = Pool | PoolClient;

type D1Result<T = QueryResultRow> = {
  results?: T[];
  success?: boolean;
};

class AccountRegisterPgD1Database {
  constructor(private readonly pool: Pool) {}

  prepare(sql: string): AccountRegisterPgD1Statement {
    return new AccountRegisterPgD1Statement(this.pool, sql);
  }

  async batch(statements: AccountRegisterPgD1Statement[]): Promise<Array<D1Result>> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const results = [];
      for (const statement of statements) results.push(await statement.runWith(client));
      await client.query("COMMIT");
      return results;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

class AccountRegisterPgD1Statement {
  private bindings: unknown[] = [];

  constructor(private readonly executor: PgExecutor, private readonly sql: string) {}

  bind(...bindings: unknown[]): this {
    this.bindings = bindings;
    return this;
  }

  async all<T = QueryResultRow>(): Promise<D1Result<T>> {
    const result = await this.query(this.executor);
    return { results: result.rows.map(normalizeRow) as T[] };
  }

  async first<T = QueryResultRow>(): Promise<T | null> {
    const result = await this.query(this.executor);
    return result.rows[0] ? (normalizeRow(result.rows[0]) as T) : null;
  }

  async run(): Promise<D1Result> {
    return this.runWith(this.executor);
  }

  async runWith(executor: PgExecutor): Promise<D1Result> {
    await this.query(executor);
    return { success: true };
  }

  private query(executor: PgExecutor) {
    return executor.query(convertPlaceholders(this.sql), this.bindings);
  }
}

export async function startAccountRegisterServer(): Promise<void> {
  const pool = getDatabasePool();
  const env = {
    DB: new AccountRegisterPgD1Database(pool) as unknown as Env["DB"],
    APP_NAME: process.env.APP_NAME ?? "Nonprofit Ledger"
  };
  const server = createServer(async (incoming, outgoing) => {
    try {
      const request = await nodeRequestToFetchRequest(incoming);
      const response = await accountRegisterResponse(request, env);
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      outgoing.writeHead(response.status, response.statusText, headers);
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      console.error(error);
      outgoing.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      outgoing.end("Something went wrong");
    }
  });
  const port = resolvePort();
  server.listen(port, () => {
    console.log(`Nonprofit Ledger listening on port ${port}`);
  });
}

async function accountRegisterResponse(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/reports/account-register") {
    return getAccountRegister(request, env);
  }
  if (request.method === "GET" && url.pathname === "/reports/account-register.csv") {
    return getAccountRegisterCsv(request, env);
  }
  return worker.fetch(request, env);
}

async function nodeRequestToFetchRequest(incoming: IncomingMessage): Promise<Request> {
  const protocol = incoming.headers["x-forwarded-proto"] ?? "http";
  const host = incoming.headers.host ?? "localhost";
  const url = `${protocol}://${host}${incoming.url ?? "/"}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(incoming.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else if (value !== undefined) {
      headers.set(key, value);
    }
  }

  const body = await readRequestBody(incoming);
  return new Request(url, {
    method: incoming.method,
    headers,
    body: ["GET", "HEAD"].includes(incoming.method ?? "GET") ? undefined : body
  });
}

async function readRequestBody(incoming: IncomingMessage): Promise<ArrayBuffer | undefined> {
  const chunks: Buffer[] = [];
  for await (const chunk of incoming) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  if (chunks.length === 0) return undefined;
  const body = Buffer.concat(chunks);
  return new Uint8Array(body).buffer;
}

function convertPlaceholders(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

function resolvePort(env: NodeJS.ProcessEnv = process.env): number {
  const port = Number(env.PORT);
  return Number.isInteger(port) && port > 0 ? port : 3000;
}

function normalizeRow<T extends QueryResultRow>(row: T): T {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [normalizeKey(key), value])) as T;
}

function normalizeKey(key: string): string {
  const aliases: Record<string, string> = {
    accountcount: "accountCount",
    activeaccountcount: "activeAccountCount",
    nextnumber: "nextNumber"
  };
  return aliases[key] ?? key;
}
