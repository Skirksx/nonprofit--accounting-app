import assert from "node:assert/strict";
import test from "node:test";
import { currentFiscalYear, fiscalYearLabel } from "../src/fiscalYears.ts";
import { parseBudgetVsActualFilters } from "../src/reports.ts";
import { budgetPage, budgetVsActualPage } from "../src/views.ts";
import type { AuthContext } from "../src/types.ts";

const context: AuthContext = {
  user: { id: "user", name: "Test", email: "test@example.test" },
  organization: { id: "org", name: "Rotary", fiscal_year_start_month: 7, base_currency: "USD", organization_profile: "rotary", logo_data_url: null },
  role: "owner", csrfToken: "test", sessionId: "test"
};

test("July fiscal year changes at July 1 and preserves ending-year keys", () => {
  assert.equal(currentFiscalYear(7, new Date("2026-06-30T23:59:59Z")), 2026);
  assert.equal(currentFiscalYear(7, new Date("2026-07-01T00:00:00Z")), 2027);
  assert.equal(currentFiscalYear(7, new Date("2027-01-01T00:00:00Z")), 2027);
  assert.equal(fiscalYearLabel(2027, 7), "2026-2027");
  assert.equal(fiscalYearLabel(2026, 7), "2025-2026");
});

test("calendar-year organizations keep single-year labels", () => {
  assert.equal(currentFiscalYear(1, new Date("2026-12-31T23:59:59Z")), 2026);
  assert.equal(fiscalYearLabel(2026, 1), "2026");
});

test("budget dropdowns retain stored keys for selected and historical budgets", async () => {
  const html = await budgetPage("Ledger", context, [], [], [{
    id: "line", organization_id: "org", fiscal_year: 2026, account_id: "account",
    account_number: "4000", account_name: "Dues", account_type: "revenue",
    fund_id: null, fund_name: null, amount_cents: 10000
  }], 2027).text();
  assert.equal((html.match(/<option value="2027" selected>2026-2027<\/option>/g) || []).length, 2);
  assert.match(html, /<option value="2026" selected>2025-2026<\/option>/);
  assert.match(html, /report.pdf\?fiscalYear=2027/);
  assert.doesNotMatch(html, /name="fiscalYear" type="number"/);
});

test("budget vs actual uses the selected ending-year key and matching label", async () => {
  const filters = parseBudgetVsActualFilters(new URL("https://example.test/?fiscalYear=2027"), "org", 7);
  assert.ok(!("errors" in filters));
  assert.equal(filters.fiscalYear, 2027);
  const html = await budgetVsActualPage("Ledger", context, [], [], {
    filters, hasBudgetLines: false, rows: [], totalBudgetCents: 0, totalActualCents: 0, totalVarianceCents: 0
  }).text();
  assert.match(html, /<option value="2027" selected>2026-2027<\/option>/);
});

test("omitted report year defaults to the organization's current fiscal year", () => {
  const filters = parseBudgetVsActualFilters(new URL("https://example.test/"), "org", 7);
  assert.ok(!("errors" in filters));
  assert.equal(filters.fiscalYear, currentFiscalYear(7));
});
