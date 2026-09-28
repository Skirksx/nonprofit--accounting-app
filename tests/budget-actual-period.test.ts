import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { fiscalYearDates } from "../src/fiscalYears.ts";
import { budgetVsActual, parseBudgetVsActualFilters } from "../src/reports.ts";
import { budgetVsActualPage } from "../src/views.ts";
import type { AuthContext, Env } from "../src/types.ts";

function filters(query = "fiscalYear=2027", month = 7) {
  const result = parseBudgetVsActualFilters(new URL("https://example.test/?" + query), "org", month);
  assert.ok(!("errors" in result));
  return result;
}

test("fiscal periods cover July rollover, calendar years and leap-year endings", () => {
  assert.deepEqual(fiscalYearDates(2027, 7), { startDate: "2026-07-01", endDate: "2027-06-30" });
  assert.deepEqual(fiscalYearDates(2026, 1), { startDate: "2026-01-01", endDate: "2026-12-31" });
  assert.deepEqual(fiscalYearDates(2024, 3), { startDate: "2023-03-01", endDate: "2024-02-29" });
  assert.equal(filters().startDate, "2026-07-01");
  assert.equal(filters("fiscalYear=2026").endDate, "2026-06-30");
  assert.equal(filters("fiscalYear=2027&endDate=2026-09-28").startDate, "2026-07-01");
  assert.equal(filters("fiscalYear=2027&startDate=2026-09-01").endDate, "2027-06-30");
});

test("custom dates cannot silently compare another year's expenses", () => {
  for (const query of [
    "fiscalYear=2027&startDate=2026-06-30",
    "fiscalYear=2027&endDate=2027-07-01",
    "fiscalYear=2027&startDate=2026-08-01&endDate=2026-07-01",
    "fiscalYear=bad", "fiscalYear=2027&startDate=not-a-date"
  ]) assert.ok("errors" in parseBudgetVsActualFilters(new URL("https://example.test/?" + query), "org", 7));
});

const context: AuthContext = {
  user: { id: "user", name: "Test", email: "test@example.test" },
  organization: { id: "org", name: "Example Rotary", fiscal_year_start_month: 7, base_currency: "USD", organization_profile: "rotary", logo_data_url: null },
  role: "owner", csrfToken: "test", sessionId: "test"
};

function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE accounts (id TEXT, account_number TEXT, account_name TEXT, account_type TEXT);
    CREATE TABLE journal_entries (id TEXT, organization_id TEXT, status TEXT, entry_date TEXT);
    CREATE TABLE journal_entry_lines (journal_entry_id TEXT, account_id TEXT, debit_amount_cents INTEGER, credit_amount_cents INTEGER, fund_id TEXT);
    CREATE TABLE budget_lines (organization_id TEXT, fiscal_year INTEGER, account_id TEXT, amount_cents INTEGER, fund_id TEXT);
    INSERT INTO accounts VALUES ('expense','5000','Supplies','expense'), ('income','4000','Dues','revenue');
    INSERT INTO journal_entries VALUES
      ('old','org','posted','2026-06-30'), ('start','org','posted','2026-07-01'),
      ('end','org','posted','2027-06-30'), ('next','org','posted','2027-07-01'),
      ('draft','org','draft','2026-07-01'), ('other','other-org','posted','2026-07-01'),
      ('refund','org','posted','2026-07-02'), ('income','org','posted','2026-07-02'),
      ('fund2','org','posted','2026-07-02');
    INSERT INTO journal_entry_lines VALUES
      ('old','expense',90000,0,'fund'), ('start','expense',10000,0,'fund'),
      ('end','expense',20000,0,'fund'), ('next','expense',90000,0,'fund'),
      ('draft','expense',90000,0,'fund'), ('other','expense',90000,0,'fund'),
      ('refund','expense',0,1000,'fund'), ('income','income',0,50000,'fund'),
      ('fund2','expense',7000,0,'fund2');
    INSERT INTO budget_lines VALUES ('org',2026,'expense',100000,'fund');
  `);
  const env = { APP_NAME: "Test", DB: { prepare(sql: string) {
    return { bind(...args: Array<string | number>) { return { async all() { return { results: db.prepare(sql).all(...args) }; } }; } };
  } } } as unknown as Env;
  return { db, env };
}

test("actual SQL includes fiscal boundaries and excludes other years, drafts and organizations", async () => {
  const { db, env } = fixture();
  try {
    const report = await budgetVsActual(env, filters());
    assert.equal(report.rows.find(r => r.account_type === "expense")?.actual_cents, 36000);
    assert.equal(report.rows.find(r => r.account_type === "revenue")?.actual_cents, 50000);
    assert.equal(report.hasBudgetLines, false); // Previous year's budget is not reused.
    const html = await budgetVsActualPage("Test", context, [], [], report).text();
    assert.match(html, /No budget lines are saved/);
    assert.match(html, /Actual expenses[\s\S]*?\$360\.00/);
    assert.match(html, /Actual income[\s\S]*?\$500\.00/);
    assert.doesNotMatch(html, /Total actual|\$860\.00/);
    assert.match(html, /Actuals: 2026-07-01 through 2027-06-30/);
    assert.match(html, /name="startDate"[^>]*value=""/); // Changing year won't resubmit stale defaults.
    assert.match(html, /Not entered/);
    const filtered = await budgetVsActual(env, filters("fiscalYear=2027&fundId=fund"));
    assert.equal(filtered.rows.find(r => r.account_type === "expense")?.actual_cents, 29000);
    const partial = await budgetVsActual(env, filters("fiscalYear=2027&endDate=2026-07-01"));
    assert.equal(partial.rows[0].actual_cents, 10000);
  } finally { db.close(); }
});

test("expense variance remains actual minus annual budget, including an explicit zero budget", async () => {
  const { db, env } = fixture();
  try {
    db.exec("INSERT INTO budget_lines VALUES ('org',2027,'expense',40000,'fund'), ('org',2027,'income',0,'fund');");
    const report = await budgetVsActual(env, filters());
    assert.equal(report.hasBudgetLines, true);
    assert.equal(report.rows.find(r => r.account_type === "expense")?.variance_cents, -4000);
    const html = await budgetVsActualPage("Test", context, [], [], report, {}, {endDate:"2027-06-30"}).text();
    assert.match(html, /Budgeted expenses[\s\S]*?\$400\.00/);
    assert.match(html, /Expenses variance[\s\S]*?-\$40\.00/);
    assert.match(html, /name="endDate"[^>]*value="2027-06-30"/);
    assert.doesNotMatch(html, /No budget lines are saved/);
  } finally { db.close(); }
});
