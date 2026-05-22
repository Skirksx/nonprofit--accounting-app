import assert from "node:assert/strict";
import test from "node:test";

import {
  listFunds,
  parseStatementOfActivitiesFilters,
  statementOfActivities
} from "../src/reports.ts";
import type { Env } from "../src/types.ts";

test("parses statement filters with date range and fund", () => {
  const url = new URL("https://example.test/reports/statement-of-activities?startDate=2026-01-01&endDate=2026-12-31&fundId=fund_1");

  const filters = parseStatementOfActivitiesFilters(url, "org_1");

  assert.deepEqual(filters, {
    organizationId: "org_1",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    fundId: "fund_1"
  });
});

test("rejects invalid statement filter dates", () => {
  const url = new URL("https://example.test/reports/statement-of-activities?startDate=2026-12-31&endDate=2026-01-01");

  const filters = parseStatementOfActivitiesFilters(url, "org_1");

  assert.deepEqual(filters, {
    errors: {
      endDate: "End date must be on or after the start date."
    }
  });
});

test("lists funds by organization", async () => {
  const env = mockEnv({
    allResults: [
      [
        {
          id: "fund_1",
          organization_id: "org_1",
          name: "General Fund",
          status: "active"
        }
      ]
    ]
  });

  const funds = await listFunds(env, "org_1");

  assert.equal(funds.length, 1);
  assert.equal(funds[0].name, "General Fund");
  assert.match(env.calls[0].sql, /FROM funds/);
  assert.deepEqual(env.calls[0].bindings, ["org_1"]);
});

test("builds statement of activities from posted journal lines", async () => {
  const env = mockEnv({
    allResults: [
      [
        {
          account_id: "acct_revenue",
          account_number: "4000",
          account_name: "Contributions",
          account_type: "revenue",
          amount_cents: 150000
        },
        {
          account_id: "acct_expense",
          account_number: "5100",
          account_name: "Program Supplies",
          account_type: "expense",
          amount_cents: 25000
        }
      ]
    ]
  });

  const report = await statementOfActivities(env, {
    organizationId: "org_1",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    fundId: "fund_1"
  });

  assert.equal(report.totalRevenueCents, 150000);
  assert.equal(report.totalExpenseCents, 25000);
  assert.equal(report.changeInNetAssetsCents, 125000);
  assert.match(env.calls[0].sql, /journal_entries.status = 'posted'/);
  assert.match(env.calls[0].sql, /journal_entry_lines.fund_id = \?/);
  assert.deepEqual(env.calls[0].bindings, ["org_1", "2026-01-01", "2026-12-31", "fund_1"]);
});

function mockEnv(options: {
  allResults?: unknown[][];
} = {}): Env & {
  calls: Array<{ sql: string; bindings: unknown[] }>;
} {
  const calls: Array<{ sql: string; bindings: unknown[] }> = [];
  let allIndex = 0;

  return {
    APP_NAME: "Test Ledger",
    calls,
    DB: {
      prepare(sql: string) {
        const call = { sql, bindings: [] as unknown[] };
        calls.push(call);

        return {
          bind(...bindings: unknown[]) {
            call.bindings = bindings;
            return this;
          },
          async all() {
            const results = options.allResults?.[allIndex] ?? [];
            allIndex += 1;
            return { results };
          }
        };
      }
    } as unknown as D1Database
  };
}
