/// <reference types="node" />

import { createServer, type IncomingMessage } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import type { Pool, PoolClient, QueryResultRow } from "pg";

import worker from "./index.ts";
import { getDatabasePool } from "./database.ts";
import type { Env } from "./types.ts";

config({ quiet: true });

type PgExecutor = Pool | PoolClient;

type D1Result<T = QueryResultRow> = {
  results?: T[];
  success?: boolean;
};

const camelAliasMap: Record<string, string> = {
  accountcount: "accountCount",
  activeaccountcount: "activeAccountCount",
  grosspaycents: "grossPayCents",
  netpaycents: "netPayCents",
  federalwithholdingcents: "federalWithholdingCents",
  stateandlocalwithholdingcents: "stateAndLocalWithholdingCents",
  employeeficamedicarecents: "employeeFicaMedicareCents",
  employerficamedicarecents: "employerFicaMedicareCents",
  retirement403bcents: "retirement403bCents",
  employercostcents: "employerCostCents",
  priorgross: "priorGross",
  nextnumber: "nextNumber"
};

class PgD1Database {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  prepare(sql: string): PgD1Statement {
    return new PgD1Statement(this.pool, sql);
  }

  async batch(statements: PgD1Statement[]): Promise<Array<D1Result>> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const results = [];
      for (const statement of statements) {
        results.push(await statement.runWith(client));
      }
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

class PgD1Statement {
  private bindings: unknown[] = [];
  private readonly executor: PgExecutor;
  private readonly sql: string;

  constructor(executor: PgExecutor, sql: string) {
    this.executor = executor;
    this.sql = sql;
  }

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

export function resolvePort(env: NodeJS.ProcessEnv = process.env): number {
  const port = Number(env.PORT);
  return Number.isInteger(port) && port > 0 ? port : 3000;
}

export function isMainModule(metaUrl: string, argvPath = process.argv[1]): boolean {
  return fileURLToPath(metaUrl) === resolve(argvPath);
}

export function convertPlaceholders(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

export async function ensurePostgresSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      fiscal_year_start_month INTEGER NOT NULL DEFAULT 1 CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
      base_currency TEXT NOT NULL DEFAULT 'USD',
      organization_profile TEXT NOT NULL DEFAULT 'church' CHECK (organization_profile IN ('church', 'rotary')),
      logo_data_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      password_iterations INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS organization_members (
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'accountant', 'viewer')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (organization_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      csrf_token TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      account_number TEXT NOT NULL,
      account_name TEXT NOT NULL,
      account_type TEXT NOT NULL CHECK (account_type IN ('asset', 'liability', 'net_asset', 'revenue', 'expense')),
      normal_balance TEXT NOT NULL CHECK (normal_balance IN ('debit', 'credit')),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (organization_id, account_number)
    );

    CREATE TABLE IF NOT EXISTS funds (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (organization_id, name)
    );

    CREATE TABLE IF NOT EXISTS journal_entries (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      entry_number TEXT NOT NULL,
      entry_date TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'void')),
      created_by_user_id TEXT NOT NULL REFERENCES users(id),
      posted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (organization_id, entry_number)
    );

    CREATE TABLE IF NOT EXISTS journal_entry_lines (
      id TEXT PRIMARY KEY,
      journal_entry_id TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      account_id TEXT NOT NULL REFERENCES accounts(id),
      fund_id TEXT REFERENCES funds(id),
      line_number INTEGER NOT NULL CHECK (line_number > 0),
      description TEXT NOT NULL DEFAULT '',
      debit_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (debit_amount_cents >= 0),
      credit_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (credit_amount_cents >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK (
        (debit_amount_cents > 0 AND credit_amount_cents = 0)
        OR (debit_amount_cents = 0 AND credit_amount_cents > 0)
      ),
      UNIQUE (journal_entry_id, line_number)
    );

    CREATE TABLE IF NOT EXISTS payroll_employees (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      employee_code TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      hourly_rate_cents INTEGER NOT NULL CHECK (hourly_rate_cents >= 0),
      default_403b_cents INTEGER NOT NULL DEFAULT 0 CHECK (default_403b_cents >= 0),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
      filing_status TEXT NOT NULL DEFAULT 'single' CHECK (filing_status IN ('single', 'married', 'head_of_household')),
      step2_checked INTEGER NOT NULL DEFAULT 0 CHECK (step2_checked IN (0, 1)),
      step3_credits_cents INTEGER NOT NULL DEFAULT 0 CHECK (step3_credits_cents >= 0),
      step4a_other_income_cents INTEGER NOT NULL DEFAULT 0 CHECK (step4a_other_income_cents >= 0),
      step4b_deductions_cents INTEGER NOT NULL DEFAULT 0 CHECK (step4b_deductions_cents >= 0),
      step4c_extra_withholding_cents INTEGER NOT NULL DEFAULT 0 CHECK (step4c_extra_withholding_cents >= 0),
      federal_exempt INTEGER NOT NULL DEFAULT 0 CHECK (federal_exempt IN (0, 1)),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (organization_id, employee_code)
    );

    CREATE TABLE IF NOT EXISTS payroll_entries (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      employee_id TEXT NOT NULL REFERENCES payroll_employees(id),
      record_number TEXT NOT NULL,
      pay_date TEXT NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      pay_frequency TEXT NOT NULL CHECK (pay_frequency IN ('weekly', 'biweekly', 'semimonthly', 'monthly')),
      hours_worked_hundredths INTEGER NOT NULL CHECK (hours_worked_hundredths >= 0),
      bonus_taxable_cents INTEGER NOT NULL DEFAULT 0 CHECK (bonus_taxable_cents >= 0),
      override_403b_cents INTEGER CHECK (override_403b_cents IS NULL OR override_403b_cents >= 0),
      gross_pay_cents INTEGER NOT NULL CHECK (gross_pay_cents >= 0),
      federal_withholding_cents INTEGER NOT NULL CHECK (federal_withholding_cents >= 0),
      ohio_withholding_cents INTEGER NOT NULL CHECK (ohio_withholding_cents >= 0),
      local_tax_cents INTEGER NOT NULL CHECK (local_tax_cents >= 0),
      retirement_403b_cents INTEGER NOT NULL CHECK (retirement_403b_cents >= 0),
      employee_ssa_cents INTEGER NOT NULL CHECK (employee_ssa_cents >= 0),
      employee_medicare_cents INTEGER NOT NULL CHECK (employee_medicare_cents >= 0),
      employer_ssa_cents INTEGER NOT NULL CHECK (employer_ssa_cents >= 0),
      employer_medicare_cents INTEGER NOT NULL CHECK (employer_medicare_cents >= 0),
      net_pay_cents INTEGER NOT NULL,
      employer_cost_cents INTEGER NOT NULL CHECK (employer_cost_cents >= 0),
      prior_ytd_gross_cents INTEGER NOT NULL DEFAULT 0 CHECK (prior_ytd_gross_cents >= 0),
      created_by_user_id TEXT NOT NULL REFERENCES users(id),
      journal_entry_id TEXT REFERENCES journal_entries(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (organization_id, record_number)
    );

    CREATE TABLE IF NOT EXISTS budget_lines (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      fiscal_year INTEGER NOT NULL CHECK (fiscal_year BETWEEN 2000 AND 2100),
      account_id TEXT NOT NULL REFERENCES accounts(id),
      fund_id TEXT REFERENCES funds(id),
      amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  try {
    await pool.query("ALTER TABLE organizations ADD COLUMN organization_profile TEXT NOT NULL DEFAULT 'church' CHECK (organization_profile IN ('church', 'rotary'))");
  } catch (error) {
    if (!String(error).includes("already exists")) throw error;
  }
}

export function createRenderServer(env: Env) {
  return createServer(async (incoming, outgoing) => {
    try {
      const request = await nodeRequestToFetchRequest(incoming);
      const response = await worker.fetch(request, env);
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
}

export async function startRenderServer(): Promise<void> {
  const pool = getDatabasePool();
  await ensurePostgresSchema(pool);
  const server = createRenderServer({
    DB: new PgD1Database(pool) as unknown as Env["DB"],
    APP_NAME: process.env.APP_NAME ?? "Nonprofit Ledger"
  });
  const port = resolvePort();
  server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

function normalizeRow<T extends QueryResultRow>(row: T): QueryResultRow {
  const normalized: QueryResultRow = { ...row };
  for (const [key, value] of Object.entries(row)) {
    const alias = camelAliasMap[key.toLowerCase()];
    if (alias) normalized[alias] = value;
  }
  return normalized;
}

async function nodeRequestToFetchRequest(incoming: IncomingMessage): Promise<Request> {
  const protocol = incoming.headers["x-forwarded-proto"] ?? "https";
  const host = incoming.headers.host ?? "localhost";
  const url = `${protocol}://${host}${incoming.url ?? "/"}`;
  const body = await readBody(incoming);
  const headers = new Headers();
  for (const [key, value] of Object.entries(incoming.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else if (value !== undefined) {
      headers.set(key, value);
    }
  }

  const requestBody =
    body.byteLength > 0 && incoming.method !== "GET" && incoming.method !== "HEAD"
      ? new Uint8Array(body).buffer
      : undefined;

  return new Request(url, {
    method: incoming.method,
    headers,
    body: requestBody
  });
}

async function readBody(incoming: IncomingMessage): Promise<Buffer> {
  const chunks = [];
  for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

if (isMainModule(import.meta.url)) {
  await startRenderServer();
}
