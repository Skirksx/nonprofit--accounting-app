import assert from "node:assert/strict";
import test from "node:test";

import type { ChartAccount } from "../src/accounts.ts";
import {
  buildJournalLinesForSimpleTransaction,
  createAndPostSimpleTransaction,
  validateSimpleTransactionForm
} from "../src/transactions.ts";
import type { Env } from "../src/types.ts";

const accounts: ChartAccount[] = [
  {
    id: "acct_cash",
    organization_id: "org_1",
    account_number: "1000",
    account_name: "Checking",
    account_type: "asset",
    normal_balance: "debit",
    status: "active"
  },
  {
    id: "acct_revenue",
    organization_id: "org_1",
    account_number: "4000",
    account_name: "Contributions",
    account_type: "revenue",
    normal_balance: "credit",
    status: "active"
  },
  {
    id: "acct_expense",
    organization_id: "org_1",
    account_number: "5100",
    account_name: "Program Supplies",
    account_type: "expense",
    normal_balance: "debit",
    status: "active"
  }
];

test("validates a simple income transaction form", () => {
  const form = transactionForm({
    transactionType: "income",
    categoryAccountId: "acct_revenue"
  });

  const result = validateSimpleTransactionForm(form, accounts, "org_1", "usr_1");

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.amountCents, 12550);
    assert.equal(result.data.transactionType, "income");
  }
});

test("rejects expense transactions that use revenue accounts", () => {
  const form = transactionForm({
    transactionType: "expense",
    categoryAccountId: "acct_revenue"
  });

  const result = validateSimpleTransactionForm(form, accounts, "org_1", "usr_1");

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.errors.categoryAccountId, "Expense transactions must use an expense account.");
  }
});

test("builds balanced journal lines for income", () => {
  const lines = buildJournalLinesForSimpleTransaction({
    organizationId: "org_1",
    createdByUserId: "usr_1",
    transactionType: "income",
    transactionDate: "2026-05-21",
    description: "Sunday offering",
    amountCents: 12550,
    cashAccountId: "acct_cash",
    categoryAccountId: "acct_revenue"
  });

  assert.deepEqual(lines, [
    {
      accountId: "acct_cash",
      description: "Sunday offering",
      debitAmountCents: 12550,
      creditAmountCents: 0
    },
    {
      accountId: "acct_revenue",
      description: "Sunday offering",
      debitAmountCents: 0,
      creditAmountCents: 12550
    }
  ]);
});

test("builds balanced journal lines for expenses", () => {
  const lines = buildJournalLinesForSimpleTransaction({
    organizationId: "org_1",
    createdByUserId: "usr_1",
    transactionType: "expense",
    transactionDate: "2026-05-21",
    description: "Buy supplies",
    amountCents: 2500,
    cashAccountId: "acct_cash",
    categoryAccountId: "acct_expense"
  });

  assert.deepEqual(lines, [
    {
      accountId: "acct_expense",
      description: "Buy supplies",
      debitAmountCents: 2500,
      creditAmountCents: 0
    },
    {
      accountId: "acct_cash",
      description: "Buy supplies",
      debitAmountCents: 0,
      creditAmountCents: 2500
    }
  ]);
});

test("creates and posts a simple transaction through the journal entry system", async () => {
  const env = mockEnv({
    firstResults: [
      { nextNumber: 3 },
      {
        id: "je_created",
        organization_id: "org_1",
        entry_number: "JE-000003",
        entry_date: "2026-05-21",
        description: "Income: Sunday offering",
        status: "draft",
        created_by_user_id: "usr_1",
        posted_at: null
      }
    ],
    allResults: [
      [
        {
          accountId: "acct_cash",
          description: "Sunday offering",
          debitAmountCents: 12550,
          creditAmountCents: 0
        },
        {
          accountId: "acct_revenue",
          description: "Sunday offering",
          debitAmountCents: 0,
          creditAmountCents: 12550
        }
      ]
    ]
  });

  const entryId = await createAndPostSimpleTransaction(env, {
    organizationId: "org_1",
    createdByUserId: "usr_1",
    transactionType: "income",
    transactionDate: "2026-05-21",
    description: "Sunday offering",
    amountCents: 12550,
    cashAccountId: "acct_cash",
    categoryAccountId: "acct_revenue"
  });

  assert.match(entryId, /^je_/);
  assert.equal(env.batchCalls[0].length, 3);
  assert.match(env.batchCalls[0][0].sql, /INSERT INTO journal_entries/);
  assert.match(env.batchCalls[0][1].sql, /INSERT INTO journal_entry_lines/);
  assert.equal(env.calls.some((call) => /UPDATE journal_entries/.test(call.sql)), true);
});

function transactionForm(overrides: Record<string, string> = {}): FormData {
  const form = new FormData();
  form.set("transactionType", overrides.transactionType ?? "income");
  form.set("transactionDate", overrides.transactionDate ?? "2026-05-21");
  form.set("description", overrides.description ?? "Sunday offering");
  form.set("amount", overrides.amount ?? "125.50");
  form.set("cashAccountId", overrides.cashAccountId ?? "acct_cash");
  form.set("categoryAccountId", overrides.categoryAccountId ?? "acct_revenue");
  return form;
}

function mockEnv(options: {
  firstResults?: unknown[];
  allResults?: unknown[][];
} = {}): Env & {
  calls: Array<{ sql: string; bindings: unknown[] }>;
  batchCalls: Array<Array<{ sql: string; bindings: unknown[] }>>;
} {
  const calls: Array<{ sql: string; bindings: unknown[] }> = [];
  const batchCalls: Array<Array<{ sql: string; bindings: unknown[] }>> = [];
  let firstIndex = 0;
  let allIndex = 0;

  return {
    APP_NAME: "Test Ledger",
    calls,
    batchCalls,
    DB: {
      prepare(sql: string) {
        const call = { sql, bindings: [] as unknown[] };
        calls.push(call);

        return {
          sql,
          bindings: call.bindings,
          bind(...bindings: unknown[]) {
            call.bindings = bindings;
            this.bindings = bindings;
            return this;
          },
          async all() {
            const results = options.allResults?.[allIndex] ?? [];
            allIndex += 1;
            return { results };
          },
          async first() {
            const result = options.firstResults?.[firstIndex] ?? null;
            firstIndex += 1;
            return result;
          },
          async run() {
            return { success: true };
          }
        };
      },
      async batch(statements: Array<{ sql: string; bindings: unknown[] }>) {
        batchCalls.push(statements.map((statement) => ({
          sql: statement.sql,
          bindings: statement.bindings
        })));
        return statements.map(() => ({ success: true }));
      }
    } as unknown as D1Database
  };
}
