import assert from "node:assert/strict";
import test from "node:test";

import {
  balanceSheet,
  budgetReport,
  budgetVsActual,
  createBudgetReportPdf,
  incomeStatement,
  listBudgetLines,
  listFunds,
  parseBalanceSheetFilters,
  parseBudgetVsActualFilters,
  parseFinancialReportFilters,
  parseStatementOfActivitiesFilters,
  statementOfActivities,
  validateBudgetLineForm,
  validateBudgetLineUpdateForm
} from "../src/reports.ts";
import type { ChartAccount } from "../src/accounts.ts";
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

test("parses balance sheet filters", () => {
  const url = new URL("https://example.test/reports/balance-sheet?asOfDate=2026-06-30&fundId=fund_1");

  const filters = parseBalanceSheetFilters(url, "org_1");

  assert.deepEqual(filters, {
    organizationId: "org_1",
    asOfDate: "2026-06-30",
    fundId: "fund_1"
  });
});

test("parses income statement filters", () => {
  const url = new URL("https://example.test/reports/income-statement?startDate=2026-01-01&endDate=2026-06-30");

  const filters = parseFinancialReportFilters(url, "org_1");

  assert.deepEqual(filters, {
    organizationId: "org_1",
    startDate: "2026-01-01",
    endDate: "2026-06-30",
    fundId: undefined
  });
});

test("parses budget vs actual fiscal year", () => {
  const url = new URL("https://example.test/reports/budget-vs-actual?fiscalYear=2026");

  const filters = parseBudgetVsActualFilters(url, "org_1");

  assert.deepEqual(filters, {
    organizationId: "org_1",
    startDate: undefined,
    endDate: undefined,
    fundId: undefined,
    fiscalYear: 2026
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

test("builds a balance sheet from posted journal balances", async () => {
  const env = mockEnv({
    allResults: [
      [
        {
          account_id: "acct_cash",
          account_number: "1000",
          account_name: "Checking",
          account_type: "asset",
          amount_cents: 250000
        },
        {
          account_id: "acct_payable",
          account_number: "2000",
          account_name: "Accounts Payable",
          account_type: "liability",
          amount_cents: 50000
        },
        {
          account_id: "acct_net",
          account_number: "3000",
          account_name: "Opening Net Assets",
          account_type: "net_asset",
          amount_cents: 150000
        }
      ],
      [
        {
          account_id: "acct_revenue",
          account_number: "4000",
          account_name: "Contributions",
          account_type: "revenue",
          amount_cents: 75000
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

  const report = await balanceSheet(env, { organizationId: "org_1", asOfDate: "2026-06-30" });

  assert.equal(report.totalAssetsCents, 250000);
  assert.equal(report.totalLiabilitiesCents, 50000);
  assert.equal(report.operatingChangeCents, 50000);
  assert.equal(report.totalLiabilitiesAndNetAssetsCents, 250000);
  assert.match(env.calls[0].sql, /accounts.account_type IN/);
});

test("builds an income statement from posted journal activity", async () => {
  const env = mockEnv({
    allResults: [
      [
        {
          account_id: "acct_revenue",
          account_number: "4000",
          account_name: "Contributions",
          account_type: "revenue",
          amount_cents: 125000
        },
        {
          account_id: "acct_expense",
          account_number: "5100",
          account_name: "Program Supplies",
          account_type: "expense",
          amount_cents: 40000
        }
      ]
    ]
  });

  const report = await incomeStatement(env, { organizationId: "org_1" });

  assert.equal(report.totalRevenueCents, 125000);
  assert.equal(report.totalExpenseCents, 40000);
  assert.equal(report.netIncomeCents, 85000);
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

test("validates a budget line for revenue and expense accounts", () => {
  const form = new FormData();
  form.set("fiscalYear", "2026");
  form.set("accountId", "acct_revenue");
  form.set("fundId", "fund_1");
  form.set("amount", "1500.00");

  const result = validateBudgetLineForm(form, accounts, funds, "org_1");

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.amountCents, 150000);
    assert.equal(result.data.fundId, "fund_1");
  }
});

test("validates a budget line update with an existing row id", () => {
  const form = new FormData();
  form.set("budgetLineId", "budget_1");
  form.set("fiscalYear", "2026");
  form.set("accountId", "acct_expense");
  form.set("fundId", "fund_1");
  form.set("amount", "500.00");

  const result = validateBudgetLineUpdateForm(form, accounts, funds, "org_1");

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.id, "budget_1");
    assert.equal(result.data.amountCents, 50000);
  }
});

test("lists editable budget lines", async () => {
  const env = mockEnv({
    allResults: [
      [
        {
          id: "budget_1",
          fiscal_year: 2026,
          account_id: "acct_expense",
          account_number: "5100",
          account_name: "Program Supplies Expense",
          account_type: "expense",
          fund_id: "fund_1",
          fund_name: "Projects",
          amount_cents: 50000
        }
      ]
    ]
  });

  const rows = await listBudgetLines(env, "org_1", 2026);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].fund_name, "Projects");
  assert.match(env.calls[0].sql, /FROM budget_lines/);
  assert.deepEqual(env.calls[0].bindings, ["org_1", 2026]);
});

test("builds annual budget report and PDF", async () => {
  const env = mockEnv({
    allResults: [
      [
        {
          id: "budget_expense",
          fiscal_year: 2026,
          account_id: "acct_expense",
          account_number: "5100",
          account_name: "Program Supplies Expense",
          account_type: "expense",
          fund_id: "fund_1",
          fund_name: "Projects",
          amount_cents: 50000
        },
        {
          id: "budget_revenue",
          fiscal_year: 2026,
          account_id: "acct_revenue",
          account_number: "4000",
          account_name: "Contributions Revenue",
          account_type: "revenue",
          fund_id: "fund_1",
          fund_name: "Projects",
          amount_cents: 75000
        }
      ]
    ]
  });

  const report = await budgetReport(env, "org_1", "Rotary Club", 2026);
  const pdf = Buffer.from(createBudgetReportPdf(report));

  assert.equal(report.totalExpensesCents, 50000);
  assert.equal(report.totalIncomeCents, 75000);
  assert.equal(report.netBudgetCents, 25000);
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
});

test("builds budget vs actual rows", async () => {
  const env = mockEnv({
    allResults: [
      [
        {
          account_id: "acct_revenue",
          account_number: "4000",
          account_name: "Contributions",
          account_type: "revenue",
          amount_cents: 120000
        }
      ],
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
          amount_cents: 50000
        }
      ]
    ]
  });

  const report = await budgetVsActual(env, { organizationId: "org_1", fiscalYear: 2026 });

  assert.equal(report.rows.length, 2);
  assert.equal(report.totalBudgetCents, 200000);
  assert.equal(report.totalActualCents, 120000);
  assert.equal(report.totalVarianceCents, -80000);
});

const accounts: ChartAccount[] = [
  account("acct_cash", "1000", "Checking", "asset", "debit"),
  account("acct_revenue", "4000", "Contributions", "revenue", "credit"),
  account("acct_expense", "5100", "Program Supplies", "expense", "debit")
];

const funds = [
  {
    id: "fund_1",
    organization_id: "org_1",
    name: "General Fund",
    status: "active" as const
  }
];

function account(
  id: string,
  account_number: string,
  account_name: string,
  account_type: ChartAccount["account_type"],
  normal_balance: ChartAccount["normal_balance"]
): ChartAccount {
  return {
    id,
    organization_id: "org_1",
    account_number,
    account_name,
    account_type,
    normal_balance,
    status: "active"
  };
}

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
          },
          async run() {
            return { success: true };
          }
        };
      }
    } as unknown as D1Database
  };
}
