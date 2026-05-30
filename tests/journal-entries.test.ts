import assert from "node:assert/strict";
import test from "node:test";

import {
  JournalEntryValidationError,
  calculateJournalTotals,
  createDraftJournalEntry,
  deleteJournalEntry,
  postJournalEntry,
  updateJournalEntry,
  validateJournalEntryEditForm,
  validateJournalEntry
} from "../src/journalEntries.ts";
import type { Env } from "../src/types.ts";

const balancedInput = {
  organizationId: "org_1",
  entryDate: "2026-05-21",
  description: "Record weekly donations",
  createdByUserId: "usr_1",
  lines: [
    {
      accountId: "acct_cash",
      description: "Cash deposit",
      debitAmountCents: 12500,
      creditAmountCents: 0
    },
    {
      accountId: "acct_revenue",
      description: "Contribution revenue",
      debitAmountCents: 0,
      creditAmountCents: 12500
    }
  ]
};

test("calculates debit and credit totals in cents", () => {
  assert.deepEqual(calculateJournalTotals(balancedInput.lines), {
    totalDebitCents: 12500,
    totalCreditCents: 12500,
    isBalanced: true
  });
});

test("validates a balanced journal entry with multiple lines", () => {
  const result = validateJournalEntry(balancedInput);

  assert.equal(result.ok, true);
  assert.deepEqual(result.totals, {
    totalDebitCents: 12500,
    totalCreditCents: 12500,
    isBalanced: true
  });
});

test("rejects posting validation when debits do not equal credits", () => {
  const result = validateJournalEntry({
    ...balancedInput,
    lines: [
      balancedInput.lines[0],
      {
        ...balancedInput.lines[1],
        creditAmountCents: 12499
      }
    ]
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.errors.balance, "Total debits must equal total credits before posting.");
  }
});

test("rejects journal entries with fewer than two lines", () => {
  const result = validateJournalEntry({
    ...balancedInput,
    lines: [balancedInput.lines[0]]
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.errors.lines, "A journal entry must have at least two lines.");
  }
});

test("rejects a line with both debit and credit amounts", () => {
  const result = validateJournalEntry({
    ...balancedInput,
    lines: [
      {
        accountId: "acct_cash",
        debitAmountCents: 500,
        creditAmountCents: 500
      },
      balancedInput.lines[1]
    ]
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.errors["lines.1.amount"], "Line cannot include both a debit and a credit.");
  }
});

test("creates a draft journal entry with one header and multiple lines", async () => {
  const env = mockEnv({
    firstResults: [{ nextNumber: 12 }]
  });

  const entryId = await createDraftJournalEntry(env, balancedInput);

  assert.match(entryId, /^je_/);
  assert.equal(env.batchCalls.length, 1);
  assert.equal(env.batchCalls[0].length, 3);
  assert.match(env.batchCalls[0][0].sql, /INSERT INTO journal_entries/);
  assert.match(env.batchCalls[0][1].sql, /INSERT INTO journal_entry_lines/);
  assert.deepEqual(env.batchCalls[0][0].bindings.slice(1), [
    "org_1",
    "JE-000012",
    "2026-05-21",
    "Record weekly donations",
    "usr_1"
  ]);
});

test("posts a balanced draft journal entry", async () => {
  const env = mockEnv({
    firstResults: [
      {
        id: "je_1",
        organization_id: "org_1",
        entry_number: "JE-000001",
        entry_date: "2026-05-21",
        description: "Record weekly donations",
        status: "draft",
        created_by_user_id: "usr_1",
        posted_at: null
      }
    ],
    allResults: [balancedInput.lines]
  });

  await postJournalEntry(env, "org_1", "je_1");

  const updateCall = env.calls.at(-1);
  assert.ok(updateCall);
  assert.match(updateCall.sql, /UPDATE journal_entries/);
  assert.deepEqual(updateCall.bindings, ["org_1", "je_1"]);
});

test("does not post an unbalanced draft journal entry", async () => {
  const env = mockEnv({
    firstResults: [
      {
        id: "je_1",
        organization_id: "org_1",
        entry_number: "JE-000001",
        entry_date: "2026-05-21",
        description: "Record weekly donations",
        status: "draft",
        created_by_user_id: "usr_1",
        posted_at: null
      }
    ],
    allResults: [
      [
        balancedInput.lines[0],
        {
          ...balancedInput.lines[1],
          creditAmountCents: 12499
        }
      ]
    ]
  });

  await assert.rejects(
    () => postJournalEntry(env, "org_1", "je_1"),
    (error) =>
      error instanceof JournalEntryValidationError &&
      error.errors.balance === "Total debits must equal total credits before posting."
  );

  assert.equal(env.calls.some((call) => /UPDATE journal_entries/.test(call.sql)), false);
});

test("validates edited journal entry form lines", () => {
  const form = new FormData();
  form.set("entryId", "je_1");
  form.set("entryDate", "2026-05-22");
  form.set("description", "Correct deposit coding");
  form.set("lineCount", "2");
  form.set("line1AccountId", "acct_cash");
  form.set("line1FundId", "fund_1");
  form.set("line1Description", "Cash deposit");
  form.set("line1Debit", "126.00");
  form.set("line1Credit", "");
  form.set("line2AccountId", "acct_revenue");
  form.set("line2FundId", "fund_1");
  form.set("line2Description", "Contribution revenue");
  form.set("line2Debit", "");
  form.set("line2Credit", "126.00");

  const result = validateJournalEntryEditForm(form, "org_1", "usr_1");

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.entryId, "je_1");
    assert.equal(result.input.lines[0].fundId, "fund_1");
    assert.equal(result.input.lines[0].debitAmountCents, 12600);
  }
});

test("updates a journal entry by replacing balanced lines", async () => {
  const env = mockEnv();

  await updateJournalEntry(env, "je_1", {
    ...balancedInput,
    entryDate: "2026-05-22",
    description: "Corrected weekly donations"
  });

  assert.equal(env.batchCalls.length, 1);
  assert.equal(env.batchCalls[0].length, 4);
  assert.match(env.batchCalls[0][0].sql, /UPDATE journal_entries/);
  assert.match(env.batchCalls[0][1].sql, /DELETE FROM journal_entry_lines/);
  assert.match(env.batchCalls[0][2].sql, /INSERT INTO journal_entry_lines/);
  assert.deepEqual(env.batchCalls[0][0].bindings, [
    "2026-05-22",
    "Corrected weekly donations",
    "org_1",
    "je_1"
  ]);
});

test("deletes a journal entry by voiding it for reports", async () => {
  const env = mockEnv();

  await deleteJournalEntry(env, "org_1", "je_1");

  assert.match(env.calls[0].sql, /UPDATE journal_entries/);
  assert.match(env.calls[0].sql, /status = 'void'/);
  assert.deepEqual(env.calls[0].bindings, ["org_1", "je_1"]);
});

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
