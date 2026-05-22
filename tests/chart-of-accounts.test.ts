import assert from "node:assert/strict";
import test from "node:test";

import { accountStats, createAccount, listAccounts } from "../src/accounts.ts";
import type { Env } from "../src/types.ts";
import { validateAccount } from "../src/validation.ts";

test("validates required chart of accounts fields", () => {
  const form = new FormData();
  form.set("accountNumber", "4000");
  form.set("accountName", "Individual Contributions");
  form.set("accountType", "revenue");
  form.set("normalBalance", "credit");
  form.set("status", "active");

  const result = validateAccount(form);

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.data, {
      accountNumber: "4000",
      accountName: "Individual Contributions",
      accountType: "revenue",
      normalBalance: "credit",
      status: "active"
    });
  }
});

test("rejects invalid chart of accounts fields", () => {
  const form = new FormData();
  form.set("accountNumber", "REV");
  form.set("accountName", "");
  form.set("accountType", "income");
  form.set("normalBalance", "left");
  form.set("status", "enabled");

  const result = validateAccount(form);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.deepEqual(Object.keys(result.errors).sort(), [
      "accountName",
      "accountNumber",
      "accountType",
      "normalBalance",
      "status"
    ]);
  }
});

test("lists accounts by organization with explicit account fields", async () => {
  const env = mockEnv({
    allResults: [
      {
        id: "acct_1",
        organization_id: "org_1",
        account_number: "1000",
        account_name: "Checking",
        account_type: "asset",
        normal_balance: "debit",
        status: "active"
      }
    ]
  });

  const accounts = await listAccounts(env, "org_1");

  assert.equal(accounts.length, 1);
  assert.equal(accounts[0].organization_id, "org_1");
  assert.equal(accounts[0].account_number, "1000");
  assert.match(env.calls[0].sql, /WHERE organization_id = \?/);
  assert.deepEqual(env.calls[0].bindings, ["org_1"]);
});

test("creates an account scoped to an organization", async () => {
  const env = mockEnv();

  await createAccount(env, {
    organizationId: "org_1",
    accountNumber: "5000",
    accountName: "Program Supplies",
    accountType: "expense",
    normalBalance: "debit",
    status: "inactive"
  });

  assert.match(env.calls[0].sql, /INSERT INTO accounts/);
  assert.deepEqual(env.calls[0].bindings.slice(1), [
    "org_1",
    "5000",
    "Program Supplies",
    "expense",
    "debit",
    "inactive"
  ]);
});

test("counts active accounts by organization", async () => {
  const env = mockEnv({
    firstResult: {
      accountCount: 4,
      activeAccountCount: 3
    }
  });

  const stats = await accountStats(env, "org_1");

  assert.deepEqual(stats, {
    accountCount: 4,
    activeAccountCount: 3
  });
  assert.match(env.calls[0].sql, /status = 'active'/);
  assert.deepEqual(env.calls[0].bindings, ["org_1"]);
});

function mockEnv(options: {
  allResults?: unknown[];
  firstResult?: unknown;
} = {}): Env & { calls: Array<{ sql: string; bindings: unknown[] }> } {
  const calls: Array<{ sql: string; bindings: unknown[] }> = [];

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
            return { results: options.allResults ?? [] };
          },
          async first() {
            return options.firstResult ?? null;
          },
          async run() {
            return { success: true };
          }
        };
      }
    } as unknown as D1Database
  };
}
