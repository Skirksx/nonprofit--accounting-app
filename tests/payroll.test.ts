import assert from "node:assert/strict";
import test from "node:test";

import type { ChartAccount } from "../src/accounts.ts";
import {
  buildPayrollJournalLines,
  calculatePayroll,
  createPayStatementPdf,
  createPayrollTaxReportPdf,
  createPayrollEntry,
  deletePayrollEmployee,
  getPayrollPayStatement,
  payrollEmployeesCsv,
  payrollEntriesCsv,
  payrollTaxReport,
  periodsForFrequency,
  updatePayrollEmployee,
  validatePayrollEmployeeForm,
  validatePayrollEmployeeUpdateForm,
  validatePayrollEntryForm,
  type PayrollPayStatement,
  type PayrollEmployee
} from "../src/payroll.ts";
import type { Env } from "../src/types.ts";

const employee: PayrollEmployee = {
  id: "pe_1",
  organization_id: "org_1",
  employee_code: "EMP001",
  employee_name: "Stephen Kirk",
  hourly_rate_cents: 10600,
  default_403b_cents: 10000,
  status: "active",
  filing_status: "single",
  step2_checked: 0,
  step3_credits_cents: 0,
  step4a_other_income_cents: 0,
  step4b_deductions_cents: 0,
  step4c_extra_withholding_cents: 5000,
  federal_exempt: 0
};

const accounts: ChartAccount[] = [
  account("acct_cash", "1000", "Checking", "asset", "debit"),
  account("acct_wages", "6100", "Wages", "expense", "debit"),
  account("acct_payroll_tax", "6110", "Payroll Tax Expense", "expense", "debit"),
  account("acct_tax_liability", "2100", "Payroll Tax Payable", "liability", "credit"),
  account("acct_403b", "2200", "403(b) Payable", "liability", "credit")
];

test("maps pay frequencies to payroll periods", () => {
  assert.equal(periodsForFrequency("weekly"), 52);
  assert.equal(periodsForFrequency("biweekly"), 26);
  assert.equal(periodsForFrequency("semimonthly"), 24);
  assert.equal(periodsForFrequency("monthly"), 12);
});

test("calculates payroll using workbook tax logic", () => {
  const result = calculatePayroll({
    organizationId: "org_1",
    createdByUserId: "usr_1",
    employeeId: "pe_1",
    payDate: "2026-03-31",
    periodStart: "2026-03-01",
    periodEnd: "2026-03-15",
    payFrequency: "semimonthly",
    hoursWorkedHundredths: 8660,
    bonusTaxableCents: 0,
    override403bCents: null,
    journalAccounts: journalAccounts(),
    employee,
    priorYtdGrossCents: 0
  });

  assert.equal(result.grossPayCents, 917960);
  assert.equal(result.retirement403bCents, 10000);
  assert.equal(result.employeeSsaCents, 56914);
  assert.equal(result.employeeMedicareCents, 13310);
  assert.equal(result.employerSsaCents, 56914);
  assert.equal(result.employerMedicareCents, 13310);
  assert.equal(result.netPayCents > 0, true);
  assert.equal(result.employerCostCents, 988184);
});

test("validates payroll employee form fields", () => {
  const form = new FormData();
  form.set("employeeCode", "emp002");
  form.set("employeeName", "Vicki Kuntz");
  form.set("hourlyRate", "152.32");
  form.set("default403b", "100.00");
  form.set("filingStatus", "married");
  form.set("status", "active");
  form.set("step2Checked", "on");

  const result = validatePayrollEmployeeForm(form, "org_1");

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.employee_code, "EMP002");
    assert.equal(result.data.hourly_rate_cents, 15232);
    assert.equal(result.data.step2_checked, 1);
  }
});

test("validates payroll employee update form with the existing employee id", () => {
  const form = employeeForm();
  form.set("employeeId", "pe_1");
  form.set("employeeName", "Stephen Kirk, Jr.");

  const result = validatePayrollEmployeeUpdateForm(form, "org_1");

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.id, "pe_1");
    assert.equal(result.data.employee_name, "Stephen Kirk, Jr.");
  }
});

test("updates a payroll employee record", async () => {
  const env = mockEnv();
  const form = employeeForm();
  form.set("employeeId", "pe_1");
  form.set("employeeName", "Stephen Kirk, Jr.");
  form.set("hourlyRate", "110.00");

  const result = await updatePayrollEmployee(env, "org_1", form);

  assert.equal(result.ok, true);
  const update = env.calls.find((call) => /UPDATE payroll_employees/.test(call.sql));
  assert.ok(update);
  assert.equal(update.bindings[0], "EMP002");
  assert.equal(update.bindings[1], "Stephen Kirk, Jr.");
  assert.equal(update.bindings[2], 11000);
  assert.equal(update.bindings.at(-2), "org_1");
  assert.equal(update.bindings.at(-1), "pe_1");
});

test("deactivates a payroll employee when payroll history exists", async () => {
  const env = mockEnv({ firstResults: [{ entryCount: 2 }] });

  await deletePayrollEmployee(env, "org_1", "pe_1");

  assert.match(env.calls[0].sql, /COUNT\(\*\)/);
  assert.match(env.calls[1].sql, /UPDATE payroll_employees SET status/);
  assert.deepEqual(env.calls[1].bindings, ["inactive", "org_1", "pe_1"]);
});

test("deletes a payroll employee when no payroll history exists", async () => {
  const env = mockEnv({ firstResults: [{ entryCount: 0 }] });

  await deletePayrollEmployee(env, "org_1", "pe_1");

  assert.match(env.calls[1].sql, /DELETE FROM payroll_employees/);
  assert.deepEqual(env.calls[1].bindings, ["org_1", "pe_1"]);
});

test("validates payroll entry form fields", () => {
  const form = payrollEntryForm();

  const result = validatePayrollEntryForm(form, [employee], accounts, "org_1", "usr_1");

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.hoursWorkedHundredths, 8660);
    assert.equal(result.data.bonusTaxableCents, 45600);
    assert.equal(result.data.override403bCents, 25000);
    assert.equal(result.data.journalAccounts.cashAccountId, "acct_cash");
  }
});

test("creates calculated payroll entry", async () => {
  const env = mockEnv({
    firstResults: [
      { priorGross: 0 },
      { nextNumber: 1 },
      { nextNumber: 8 },
      {
        id: "je_created",
        organization_id: "org_1",
        entry_number: "JE-000008",
        entry_date: "2026-03-31",
        description: "Payroll: Stephen Kirk 20260331-EMP001-001",
        status: "draft",
        created_by_user_id: "usr_1",
        posted_at: null
      }
    ],
    allResults: [
      [
        { accountId: "acct_wages", debitAmountCents: 963560, creditAmountCents: 0, description: "Payroll 20260331-EMP001-001" },
        { accountId: "acct_payroll_tax", debitAmountCents: 73713, creditAmountCents: 0, description: "Payroll 20260331-EMP001-001" },
        { accountId: "acct_cash", debitAmountCents: 0, creditAmountCents: 727054, description: "Payroll 20260331-EMP001-001" },
        { accountId: "acct_tax_liability", debitAmountCents: 0, creditAmountCents: 285219, description: "Payroll 20260331-EMP001-001" },
        { accountId: "acct_403b", debitAmountCents: 0, creditAmountCents: 25000, description: "Payroll 20260331-EMP001-001" }
      ]
    ]
  });
  const form = payrollEntryForm();
  const result = validatePayrollEntryForm(form, [employee], accounts, "org_1", "usr_1");
  assert.equal(result.ok, true);
  if (!result.ok) return;

  const created = await createPayrollEntry(env, result.data, [employee]);

  assert.equal(created.ok, true);
  assert.equal(env.batchCalls[0].length, 6);
  assert.match(env.batchCalls[0][0].sql, /INSERT INTO journal_entries/);
  assert.equal(env.calls.some((call) => /UPDATE journal_entries/.test(call.sql)), true);
  assert.equal(env.calls.some((call) => /INSERT INTO payroll_entries/.test(call.sql)), true);
  const insert = env.calls.find((call) => /INSERT INTO payroll_entries/.test(call.sql));
  assert.equal(insert?.bindings[3], "20260331-EMP001-001");
  assert.equal(insert?.bindings[11], 963560);
  assert.match(String(insert?.bindings[24]), /^je_/);
});

test("builds balanced payroll journal lines", () => {
  const calculation = calculatePayroll({
    organizationId: "org_1",
    createdByUserId: "usr_1",
    employeeId: "pe_1",
    payDate: "2026-03-31",
    periodStart: "2026-03-01",
    periodEnd: "2026-03-15",
    payFrequency: "semimonthly",
    hoursWorkedHundredths: 8660,
    bonusTaxableCents: 45600,
    override403bCents: 25000,
    journalAccounts: journalAccounts(),
    employee,
    priorYtdGrossCents: 0
  });

  const lines = buildPayrollJournalLines(calculation, journalAccounts(), "Payroll 20260331-EMP001-001");
  const debit = lines.reduce((sum, line) => sum + line.debitAmountCents, 0);
  const credit = lines.reduce((sum, line) => sum + line.creditAmountCents, 0);

  assert.equal(debit, credit);
  assert.deepEqual(lines.map((line) => line.accountId), [
    "acct_wages",
    "acct_payroll_tax",
    "acct_cash",
    "acct_tax_liability",
    "acct_403b"
  ]);
});

test("loads a payroll pay statement by organization and entry", async () => {
  const env = mockEnv({
    firstResults: [payStatement]
  });

  const result = await getPayrollPayStatement(env, "org_1", "pay_1");

  assert.equal(result?.record_number, "20260331-EMP001-001");
  assert.match(env.calls[0].sql, /FROM payroll_entries/);
  assert.deepEqual(env.calls[0].bindings, ["org_1", "pay_1"]);
});

test("creates a PDF pay statement", () => {
  const pdf = createPayStatementPdf(payStatement);
  const text = new TextDecoder().decode(pdf);

  assert.match(text, /^%PDF-1.4/);
  assert.match(text, /Employee Pay Statement/);
  assert.match(text, /Net pay/);
  assert.match(text, /startxref/);
});

test("builds payroll tax report totals for a custom date range", async () => {
  const env = mockEnv({
    allResults: [
      [
        {
          pay_date: "2026-03-31",
          record_number: "20260331-EMP001-001",
          employee_code: "EMP001",
          employee_name: "Stephen Kirk",
          gross_pay_cents: 963560,
          federal_withholding_cents: 104239,
          state_withholding_cents: 23890,
          employer_ssa_cents: 59741,
          employer_medicare_cents: 13972,
          employer_tax_cents: 73713
        },
        {
          pay_date: "2026-04-15",
          record_number: "20260415-EMP002-001",
          employee_code: "EMP002",
          employee_name: "Vicki Kuntz",
          gross_pay_cents: 120000,
          federal_withholding_cents: 10000,
          state_withholding_cents: 3000,
          employer_ssa_cents: 7440,
          employer_medicare_cents: 1740,
          employer_tax_cents: 9180
        }
      ]
    ]
  });

  const report = await payrollTaxReport(env, "org_1", "McConnelsville Methodist Church", "2026-03-01", "2026-04-30");

  assert.equal(report.rows.length, 2);
  assert.equal(report.totals.grossPayCents, 1083560);
  assert.equal(report.totals.federalWithholdingCents, 114239);
  assert.equal(report.totals.stateWithholdingCents, 26890);
  assert.equal(report.totals.employerSsaCents, 67181);
  assert.equal(report.totals.employerMedicareCents, 15712);
  assert.equal(report.totals.employerTaxCents, 82893);
  assert.deepEqual(env.calls[0].bindings, ["org_1", "2026-03-01", "2026-04-30"]);
});

test("creates a payroll tax report PDF with organization branding", () => {
  const pdf = createPayrollTaxReportPdf(
    {
      organizationName: "McConnelsville Methodist Church",
      startDate: "2026-03-01",
      endDate: "2026-04-30",
      rows: [
        {
          pay_date: "2026-03-31",
          record_number: "20260331-EMP001-001",
          employee_code: "EMP001",
          employee_name: "Stephen Kirk",
          gross_pay_cents: 963560,
          federal_withholding_cents: 104239,
          state_withholding_cents: 23890,
          employer_ssa_cents: 59741,
          employer_medicare_cents: 13972,
          employer_tax_cents: 73713
        }
      ],
      totals: {
        grossPayCents: 963560,
        federalWithholdingCents: 104239,
        stateWithholdingCents: 23890,
        employerSsaCents: 59741,
        employerMedicareCents: 13972,
        employerTaxCents: 73713
      }
    },
    null
  );
  const text = new TextDecoder().decode(pdf);

  assert.match(text, /^%PDF-1.4/);
  assert.match(text, /Employer Payroll Tax Report/);
  assert.match(text, /McConnelsville Methodist Church/);
  assert.match(text, /Federal withholding/);
  assert.match(text, /State withholding/);
  assert.match(text, /Total employer payroll tax/);
});

test("payroll tax report PDF explains when no entries match", () => {
  const pdf = createPayrollTaxReportPdf(
    {
      organizationName: "McConnelsville Methodist Church",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
      rows: [],
      totals: {
        grossPayCents: 0,
        federalWithholdingCents: 0,
        stateWithholdingCents: 0,
        employerSsaCents: 0,
        employerMedicareCents: 0,
        employerTaxCents: 0
      }
    },
    null
  );
  const text = new TextDecoder().decode(pdf);

  assert.match(text, /No payroll entries matched this date range/);
});

test("exports payroll employee records as CSV", () => {
  const csv = payrollEmployeesCsv([{ ...employee, employee_name: "Kirk, Stephen" }]);

  assert.match(csv, /^employee_id,employee_code,employee_name/);
  assert.match(csv, /"Kirk, Stephen"/);
  assert.match(csv, /106.00/);
});

test("exports payroll entries as CSV", () => {
  const csv = payrollEntriesCsv([
    {
      ...payStatement,
      journal_entry_id: "je_1"
    }
  ]);

  assert.match(csv, /^record_number,pay_date,period_start/);
  assert.match(csv, /20260331-EMP001-001/);
  assert.match(csv, /9179.60|9635.60/);
  assert.match(csv, /je_1/);
});

function employeeForm(): FormData {
  const form = new FormData();
  form.set("employeeCode", "emp002");
  form.set("employeeName", "Vicki Kuntz");
  form.set("hourlyRate", "152.32");
  form.set("default403b", "100.00");
  form.set("filingStatus", "married");
  form.set("status", "active");
  form.set("step2Checked", "on");
  return form;
}

function payrollEntryForm(): FormData {
  const form = new FormData();
  form.set("employeeId", "pe_1");
  form.set("payDate", "2026-03-31");
  form.set("periodStart", "2026-03-01");
  form.set("periodEnd", "2026-03-15");
  form.set("payFrequency", "semimonthly");
  form.set("hoursWorked", "86.60");
  form.set("bonusTaxable", "456.00");
  form.set("override403b", "250.00");
  form.set("cashAccountId", "acct_cash");
  form.set("wageExpenseAccountId", "acct_wages");
  form.set("payrollTaxExpenseAccountId", "acct_payroll_tax");
  form.set("withholdingLiabilityAccountId", "acct_tax_liability");
  form.set("retirementLiabilityAccountId", "acct_403b");
  return form;
}

function journalAccounts() {
  return {
    cashAccountId: "acct_cash",
    wageExpenseAccountId: "acct_wages",
    payrollTaxExpenseAccountId: "acct_payroll_tax",
    withholdingLiabilityAccountId: "acct_tax_liability",
    retirementLiabilityAccountId: "acct_403b"
  };
}

const payStatement: PayrollPayStatement = {
  id: "pay_1",
  organization_name: "McConnelsville Methodist Church",
  record_number: "20260331-EMP001-001",
  pay_date: "2026-03-31",
  period_start: "2026-03-01",
  period_end: "2026-03-15",
  pay_frequency: "semimonthly",
  hours_worked_hundredths: 8660,
  bonus_taxable_cents: 45600,
  employee_code: "EMP001",
  employee_name: "Stephen Kirk",
  gross_pay_cents: 963560,
  federal_withholding_cents: 104239,
  ohio_withholding_cents: 23890,
  local_tax_cents: 9636,
  retirement_403b_cents: 25000,
  employee_ssa_cents: 59741,
  employee_medicare_cents: 13972,
  employer_ssa_cents: 59741,
  employer_medicare_cents: 13972,
  net_pay_cents: 727082,
  employer_cost_cents: 1037273
};

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
