import type { ChartAccount } from "./accounts.ts";
import { randomId } from "./crypto.ts";
import { createDraftJournalEntry, postJournalEntry, type JournalEntryLineInput } from "./journalEntries.ts";
import type { Env } from "./types.ts";
import type { ValidationResult } from "./validation.ts";

export type PayFrequency = "weekly" | "biweekly" | "semimonthly" | "monthly";
export type PayrollFilingStatus = "single" | "married" | "head_of_household";

export type PayrollEmployee = {
  id: string;
  organization_id: string;
  employee_code: string;
  employee_name: string;
  hourly_rate_cents: number;
  default_403b_cents: number;
  status: "active" | "inactive";
  filing_status: PayrollFilingStatus;
  step2_checked: number;
  step3_credits_cents: number;
  step4a_other_income_cents: number;
  step4b_deductions_cents: number;
  step4c_extra_withholding_cents: number;
  federal_exempt: number;
};

export type PayrollEntrySummary = {
  id: string;
  record_number: string;
  pay_date: string;
  employee_code: string;
  employee_name: string;
  gross_pay_cents: number;
  federal_withholding_cents: number;
  ohio_withholding_cents: number;
  local_tax_cents: number;
  retirement_403b_cents: number;
  employee_ssa_cents: number;
  employee_medicare_cents: number;
  net_pay_cents: number;
  employer_cost_cents: number;
};

export type PayrollEntryExportRow = PayrollEntrySummary & {
  period_start: string;
  period_end: string;
  pay_frequency: PayFrequency;
  hours_worked_hundredths: number;
  bonus_taxable_cents: number;
  employer_ssa_cents: number;
  employer_medicare_cents: number;
  journal_entry_id: string | null;
};

export type PayrollPayStatement = PayrollEntrySummary & {
  organization_name: string;
  period_start: string;
  period_end: string;
  pay_frequency: PayFrequency;
  hours_worked_hundredths: number;
  bonus_taxable_cents: number;
  employer_ssa_cents: number;
  employer_medicare_cents: number;
};

export type PayrollEntryDraft = {
  organizationId: string;
  createdByUserId: string;
  employeeId: string;
  payDate: string;
  periodStart: string;
  periodEnd: string;
  payFrequency: PayFrequency;
  hoursWorkedHundredths: number;
  bonusTaxableCents: number;
  override403bCents: number | null;
  journalAccounts: PayrollJournalAccounts;
};

export type PayrollJournalAccounts = {
  cashAccountId: string;
  wageExpenseAccountId: string;
  payrollTaxExpenseAccountId: string;
  withholdingLiabilityAccountId: string;
  retirementLiabilityAccountId: string;
};

export type PayrollCalculationInput = PayrollEntryDraft & {
  employee: PayrollEmployee;
  priorYtdGrossCents: number;
};

export type PayrollCalculation = {
  periodsPerYear: number;
  annualizedGrossCents: number;
  fitTaxableWagesCents: number;
  adjustedAnnualWageCents: number;
  tentativeAnnualFederalTaxCents: number;
  grossPayCents: number;
  federalWithholdingCents: number;
  ohioWithholdingCents: number;
  localTaxCents: number;
  retirement403bCents: number;
  employeeSsaCents: number;
  employeeMedicareCents: number;
  employerSsaCents: number;
  employerMedicareCents: number;
  netPayCents: number;
  employerCostCents: number;
};

export type PayrollSummary = {
  year: number;
  grossPayCents: number;
  netPayCents: number;
  federalWithholdingCents: number;
  stateAndLocalWithholdingCents: number;
  employeeFicaMedicareCents: number;
  employerFicaMedicareCents: number;
  retirement403bCents: number;
  employerCostCents: number;
};

export type PayrollTaxReportRow = {
  pay_date: string;
  record_number: string;
  employee_code: string;
  employee_name: string;
  gross_pay_cents: number;
  federal_withholding_cents: number;
  state_withholding_cents: number;
  employer_ssa_cents: number;
  employer_medicare_cents: number;
  employer_tax_cents: number;
};

export type PayrollTaxReport = {
  organizationName: string;
  startDate: string;
  endDate: string;
  rows: PayrollTaxReportRow[];
  totals: {
    grossPayCents: number;
    federalWithholdingCents: number;
    stateWithholdingCents: number;
    employerSsaCents: number;
    employerMedicareCents: number;
    employerTaxCents: number;
  };
};

const RATES = {
  employeeSocialSecurity: 0.062,
  employeeMedicare: 0.0145,
  additionalMedicare: 0.009,
  employerSocialSecurity: 0.062,
  employerMedicare: 0.0145,
  socialSecurityWageBaseCents: 18_450_000,
  additionalMedicareThresholdCents: 20_000_000,
  ohioLocalThresholdCents: 2_605_000,
  localTaxRate: 0.01,
  singleStandardDeductionAdjustmentCents: 860_000,
  marriedStandardDeductionAdjustmentCents: 1_290_000
};

const FEDERAL_BRACKETS: Record<PayrollFilingStatus, { standard: TaxBracket[]; step2: TaxBracket[] }> = {
  married: {
    standard: [
      bracket(0, 0, 0),
      bracket(1_930_000, 0, 0.1),
      bracket(4_410_000, 248_000, 0.12),
      bracket(12_010_000, 1_160_000, 0.22),
      bracket(23_070_000, 3_593_200, 0.24),
      bracket(42_285_000, 8_204_800, 0.32),
      bracket(53_175_000, 11_689_600, 0.35),
      bracket(78_800_000, 20_658_350, 0.37)
    ],
    step2: [
      bracket(0, 0, 0),
      bracket(1_610_000, 0, 0.1),
      bracket(2_850_000, 124_000, 0.12),
      bracket(6_650_000, 580_000, 0.22),
      bracket(12_180_000, 1_796_600, 0.24),
      bracket(21_787_500, 4_102_400, 0.32),
      bracket(27_232_500, 5_844_800, 0.35),
      bracket(40_045_000, 10_329_175, 0.37)
    ]
  },
  head_of_household: {
    standard: [
      bracket(0, 0, 0),
      bracket(1_555_000, 0, 0.1),
      bracket(3_325_000, 177_000, 0.12),
      bracket(8_300_000, 774_000, 0.22),
      bracket(12_125_000, 1_615_500, 0.24),
      bracket(21_730_000, 3_920_700, 0.32),
      bracket(27_175_000, 5_663_100, 0.35),
      bracket(65_615_000, 19_117_100, 0.37)
    ],
    step2: [
      bracket(0, 0, 0),
      bracket(1_207_500, 0, 0.1),
      bracket(2_092_500, 88_500, 0.12),
      bracket(4_580_000, 387_000, 0.22),
      bracket(6_492_500, 807_750, 0.24),
      bracket(11_295_000, 1_960_350, 0.32),
      bracket(14_017_500, 2_831_550, 0.35),
      bracket(33_237_500, 9_558_550, 0.37)
    ]
  },
  single: {
    standard: [
      bracket(0, 0, 0),
      bracket(750_000, 0, 0.1),
      bracket(1_990_000, 124_000, 0.12),
      bracket(5_790_000, 580_000, 0.22),
      bracket(11_320_000, 1_796_600, 0.24),
      bracket(20_927_500, 4_102_400, 0.32),
      bracket(26_372_500, 5_844_800, 0.35),
      bracket(64_810_000, 19_297_925, 0.37)
    ],
    step2: [
      bracket(0, 0, 0),
      bracket(805_000, 0, 0.1),
      bracket(1_425_000, 62_000, 0.12),
      bracket(3_325_000, 290_000, 0.22),
      bracket(6_090_000, 898_300, 0.24),
      bracket(10_893_800, 2_051_200, 0.32),
      bracket(13_616_300, 2_922_400, 0.35),
      bracket(32_835_000, 9_648_963, 0.37)
    ]
  }
};

type TaxBracket = {
  thresholdCents: number;
  baseTaxCents: number;
  rate: number;
};

export async function listPayrollEmployees(env: Env, organizationId: string): Promise<PayrollEmployee[]> {
  const result = await env.DB.prepare(
    `SELECT
      id,
      organization_id,
      employee_code,
      employee_name,
      hourly_rate_cents,
      default_403b_cents,
      status,
      filing_status,
      step2_checked,
      step3_credits_cents,
      step4a_other_income_cents,
      step4b_deductions_cents,
      step4c_extra_withholding_cents,
      federal_exempt
     FROM payroll_employees
     WHERE organization_id = ?
     ORDER BY employee_code ASC`
  )
    .bind(organizationId)
    .all<PayrollEmployee>();

  return result.results ?? [];
}

export async function listPayrollEntries(env: Env, organizationId: string): Promise<PayrollEntrySummary[]> {
  const result = await env.DB.prepare(
    `SELECT
      payroll_entries.id,
      payroll_entries.record_number,
      payroll_entries.pay_date,
      payroll_employees.employee_code,
      payroll_employees.employee_name,
      payroll_entries.gross_pay_cents,
      payroll_entries.federal_withholding_cents,
      payroll_entries.ohio_withholding_cents,
      payroll_entries.local_tax_cents,
      payroll_entries.retirement_403b_cents,
      payroll_entries.employee_ssa_cents,
      payroll_entries.employee_medicare_cents,
      payroll_entries.net_pay_cents,
      payroll_entries.employer_cost_cents
     FROM payroll_entries
     JOIN payroll_employees ON payroll_employees.id = payroll_entries.employee_id
     WHERE payroll_entries.organization_id = ?
     ORDER BY payroll_entries.pay_date DESC, payroll_entries.created_at DESC
     LIMIT 25`
  )
    .bind(organizationId)
    .all<PayrollEntrySummary>();

  return result.results ?? [];
}

export async function listPayrollEntryExportRows(env: Env, organizationId: string): Promise<PayrollEntryExportRow[]> {
  const result = await env.DB.prepare(
    `SELECT
      payroll_entries.id,
      payroll_entries.record_number,
      payroll_entries.pay_date,
      payroll_entries.period_start,
      payroll_entries.period_end,
      payroll_entries.pay_frequency,
      payroll_entries.hours_worked_hundredths,
      payroll_entries.bonus_taxable_cents,
      payroll_employees.employee_code,
      payroll_employees.employee_name,
      payroll_entries.gross_pay_cents,
      payroll_entries.federal_withholding_cents,
      payroll_entries.ohio_withholding_cents,
      payroll_entries.local_tax_cents,
      payroll_entries.retirement_403b_cents,
      payroll_entries.employee_ssa_cents,
      payroll_entries.employee_medicare_cents,
      payroll_entries.employer_ssa_cents,
      payroll_entries.employer_medicare_cents,
      payroll_entries.net_pay_cents,
      payroll_entries.employer_cost_cents,
      payroll_entries.journal_entry_id
     FROM payroll_entries
     JOIN payroll_employees ON payroll_employees.id = payroll_entries.employee_id
     WHERE payroll_entries.organization_id = ?
     ORDER BY payroll_entries.pay_date ASC, payroll_entries.record_number ASC`
  )
    .bind(organizationId)
    .all<PayrollEntryExportRow>();

  return result.results ?? [];
}

export async function getPayrollPayStatement(
  env: Env,
  organizationId: string,
  entryId: string
): Promise<PayrollPayStatement | null> {
  return env.DB.prepare(
    `SELECT
      payroll_entries.id,
      payroll_entries.record_number,
      payroll_entries.pay_date,
      payroll_entries.period_start,
      payroll_entries.period_end,
      payroll_entries.pay_frequency,
      payroll_entries.hours_worked_hundredths,
      payroll_entries.bonus_taxable_cents,
      payroll_employees.employee_code,
      payroll_employees.employee_name,
      organizations.name AS organization_name,
      payroll_entries.gross_pay_cents,
      payroll_entries.federal_withholding_cents,
      payroll_entries.ohio_withholding_cents,
      payroll_entries.local_tax_cents,
      payroll_entries.retirement_403b_cents,
      payroll_entries.employee_ssa_cents,
      payroll_entries.employee_medicare_cents,
      payroll_entries.employer_ssa_cents,
      payroll_entries.employer_medicare_cents,
      payroll_entries.net_pay_cents,
      payroll_entries.employer_cost_cents
     FROM payroll_entries
     JOIN payroll_employees ON payroll_employees.id = payroll_entries.employee_id
     JOIN organizations ON organizations.id = payroll_entries.organization_id
     WHERE payroll_entries.organization_id = ? AND payroll_entries.id = ?
     LIMIT 1`
  )
    .bind(organizationId, entryId)
    .first<PayrollPayStatement>();
}

export async function payrollSummary(env: Env, organizationId: string, year: number): Promise<PayrollSummary> {
  const startDate = `${year}-01-01`;
  const endDate = `${year + 1}-01-01`;
  const row = await env.DB.prepare(
    `SELECT
      COALESCE(SUM(gross_pay_cents), 0) AS grossPayCents,
      COALESCE(SUM(net_pay_cents), 0) AS netPayCents,
      COALESCE(SUM(federal_withholding_cents), 0) AS federalWithholdingCents,
      COALESCE(SUM(ohio_withholding_cents + local_tax_cents), 0) AS stateAndLocalWithholdingCents,
      COALESCE(SUM(employee_ssa_cents + employee_medicare_cents), 0) AS employeeFicaMedicareCents,
      COALESCE(SUM(employer_ssa_cents + employer_medicare_cents), 0) AS employerFicaMedicareCents,
      COALESCE(SUM(retirement_403b_cents), 0) AS retirement403bCents,
      COALESCE(SUM(employer_cost_cents), 0) AS employerCostCents
     FROM payroll_entries
     WHERE organization_id = ? AND pay_date >= ? AND pay_date < ?`
  )
    .bind(organizationId, startDate, endDate)
    .first<Omit<PayrollSummary, "year">>();

  return {
    year,
    grossPayCents: row?.grossPayCents ?? 0,
    netPayCents: row?.netPayCents ?? 0,
    federalWithholdingCents: row?.federalWithholdingCents ?? 0,
    stateAndLocalWithholdingCents: row?.stateAndLocalWithholdingCents ?? 0,
    employeeFicaMedicareCents: row?.employeeFicaMedicareCents ?? 0,
    employerFicaMedicareCents: row?.employerFicaMedicareCents ?? 0,
    retirement403bCents: row?.retirement403bCents ?? 0,
    employerCostCents: row?.employerCostCents ?? 0
  };
}

export async function payrollTaxReport(
  env: Env,
  organizationId: string,
  organizationName: string,
  startDate: string,
  endDate: string
): Promise<PayrollTaxReport> {
  const result = await env.DB.prepare(
    `SELECT
      payroll_entries.pay_date,
      payroll_entries.record_number,
      payroll_employees.employee_code,
      payroll_employees.employee_name,
      payroll_entries.gross_pay_cents,
      payroll_entries.federal_withholding_cents,
      payroll_entries.ohio_withholding_cents AS state_withholding_cents,
      payroll_entries.employer_ssa_cents,
      payroll_entries.employer_medicare_cents,
      payroll_entries.employer_ssa_cents + payroll_entries.employer_medicare_cents AS employer_tax_cents
     FROM payroll_entries
     JOIN payroll_employees ON payroll_employees.id = payroll_entries.employee_id
     WHERE payroll_entries.organization_id = ?
       AND payroll_entries.pay_date >= ?
       AND payroll_entries.pay_date <= ?
     ORDER BY payroll_entries.pay_date ASC, payroll_employees.employee_name ASC`
  )
    .bind(organizationId, startDate, endDate)
    .all<PayrollTaxReportRow>();
  const rows = result.results ?? [];

  return {
    organizationName,
    startDate,
    endDate,
    rows,
    totals: rows.reduce(
      (totals, row) => ({
        grossPayCents: totals.grossPayCents + row.gross_pay_cents,
        federalWithholdingCents: totals.federalWithholdingCents + row.federal_withholding_cents,
        stateWithholdingCents: totals.stateWithholdingCents + row.state_withholding_cents,
        employerSsaCents: totals.employerSsaCents + row.employer_ssa_cents,
        employerMedicareCents: totals.employerMedicareCents + row.employer_medicare_cents,
        employerTaxCents: totals.employerTaxCents + row.employer_tax_cents
      }),
      {
        grossPayCents: 0,
        federalWithholdingCents: 0,
        stateWithholdingCents: 0,
        employerSsaCents: 0,
        employerMedicareCents: 0,
        employerTaxCents: 0
      }
    )
  };
}

export async function createPayrollEmployee(
  env: Env,
  organizationId: string,
  form: FormData
): Promise<ValidationResult<PayrollEmployee>> {
  const result = validatePayrollEmployeeForm(form, organizationId);
  if (!result.ok) return result;

  try {
    await env.DB.prepare(
      `INSERT INTO payroll_employees (
      id,
      organization_id,
      employee_code,
      employee_name,
      hourly_rate_cents,
      default_403b_cents,
      status,
      filing_status,
      step2_checked,
      step3_credits_cents,
      step4a_other_income_cents,
      step4b_deductions_cents,
      step4c_extra_withholding_cents,
      federal_exempt
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
      .bind(
        result.data.id,
        organizationId,
        result.data.employee_code,
        result.data.employee_name,
        result.data.hourly_rate_cents,
        result.data.default_403b_cents,
        result.data.status,
        result.data.filing_status,
        result.data.step2_checked,
        result.data.step3_credits_cents,
        result.data.step4a_other_income_cents,
        result.data.step4b_deductions_cents,
        result.data.step4c_extra_withholding_cents,
        result.data.federal_exempt
      )
      .run();
  } catch (error) {
    return { ok: false, errors: { employeeCode: "That employee ID already exists." } };
  }

  return result;
}

export async function updatePayrollEmployee(
  env: Env,
  organizationId: string,
  form: FormData
): Promise<ValidationResult<PayrollEmployee>> {
  const result = validatePayrollEmployeeUpdateForm(form, organizationId);
  if (!result.ok) return result;

  try {
    await env.DB.prepare(
      `UPDATE payroll_employees
       SET employee_code = ?,
           employee_name = ?,
           hourly_rate_cents = ?,
           default_403b_cents = ?,
           status = ?,
           filing_status = ?,
           step2_checked = ?,
           step3_credits_cents = ?,
           step4a_other_income_cents = ?,
           step4b_deductions_cents = ?,
           step4c_extra_withholding_cents = ?,
           federal_exempt = ?
       WHERE organization_id = ? AND id = ?`
    )
      .bind(
        result.data.employee_code,
        result.data.employee_name,
        result.data.hourly_rate_cents,
        result.data.default_403b_cents,
        result.data.status,
        result.data.filing_status,
        result.data.step2_checked,
        result.data.step3_credits_cents,
        result.data.step4a_other_income_cents,
        result.data.step4b_deductions_cents,
        result.data.step4c_extra_withholding_cents,
        result.data.federal_exempt,
        organizationId,
        result.data.id
      )
      .run();
  } catch (error) {
    return { ok: false, errors: { employeeCode: "That employee ID already exists." } };
  }

  return result;
}

export async function deletePayrollEmployee(env: Env, organizationId: string, employeeId: string): Promise<void> {
  if (!employeeId) return;

  const usage = await env.DB.prepare(
    `SELECT COUNT(*) AS entryCount
     FROM payroll_entries
     WHERE organization_id = ? AND employee_id = ?`
  )
    .bind(organizationId, employeeId)
    .first<{ entryCount: number }>();

  if ((usage?.entryCount ?? 0) > 0) {
    await env.DB.prepare("UPDATE payroll_employees SET status = ? WHERE organization_id = ? AND id = ?")
      .bind("inactive", organizationId, employeeId)
      .run();
    return;
  }

  await env.DB.prepare("DELETE FROM payroll_employees WHERE organization_id = ? AND id = ?")
    .bind(organizationId, employeeId)
    .run();
}

export async function createPayrollEntry(
  env: Env,
  draft: PayrollEntryDraft,
  employees: PayrollEmployee[]
): Promise<ValidationResult<{ id: string; recordNumber: string }>> {
  const employee = employees.find(
    (item) => item.id === draft.employeeId && item.organization_id === draft.organizationId && item.status === "active"
  );
  if (!employee) return { ok: false, errors: { employeeId: "Choose an active employee." } };

  const priorYtdGrossCents = await priorGrossForYear(env, draft.organizationId, draft.employeeId, draft.payDate);
  const calculation = calculatePayroll({ ...draft, employee, priorYtdGrossCents });
  if (calculation.netPayCents < 0) {
    return { ok: false, errors: { payroll: "Net pay is below zero. Check withholding and 403(b) amounts." } };
  }

  const id = randomId("pay");
  const recordNumber = await nextPayrollRecordNumber(env, draft.organizationId, draft.employeeId, employee.employee_code, draft.payDate);
  const journalEntryId = await createDraftJournalEntry(env, {
    organizationId: draft.organizationId,
    entryDate: draft.payDate,
    description: `Payroll: ${employee.employee_name} ${recordNumber}`,
    createdByUserId: draft.createdByUserId,
    lines: buildPayrollJournalLines(calculation, draft.journalAccounts, `Payroll ${recordNumber}`)
  });
  await postJournalEntry(env, draft.organizationId, journalEntryId);

  await env.DB.prepare(
    `INSERT INTO payroll_entries (
      id,
      organization_id,
      employee_id,
      record_number,
      pay_date,
      period_start,
      period_end,
      pay_frequency,
      hours_worked_hundredths,
      bonus_taxable_cents,
      override_403b_cents,
      gross_pay_cents,
      federal_withholding_cents,
      ohio_withholding_cents,
      local_tax_cents,
      retirement_403b_cents,
      employee_ssa_cents,
      employee_medicare_cents,
      employer_ssa_cents,
      employer_medicare_cents,
      net_pay_cents,
      employer_cost_cents,
      prior_ytd_gross_cents,
      created_by_user_id,
      journal_entry_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      draft.organizationId,
      draft.employeeId,
      recordNumber,
      draft.payDate,
      draft.periodStart,
      draft.periodEnd,
      draft.payFrequency,
      draft.hoursWorkedHundredths,
      draft.bonusTaxableCents,
      draft.override403bCents,
      calculation.grossPayCents,
      calculation.federalWithholdingCents,
      calculation.ohioWithholdingCents,
      calculation.localTaxCents,
      calculation.retirement403bCents,
      calculation.employeeSsaCents,
      calculation.employeeMedicareCents,
      calculation.employerSsaCents,
      calculation.employerMedicareCents,
      calculation.netPayCents,
      calculation.employerCostCents,
      priorYtdGrossCents,
      draft.createdByUserId,
      journalEntryId
    )
    .run();

  return { ok: true, data: { id, recordNumber } };
}

export function validatePayrollEmployeeForm(form: FormData, organizationId: string): ValidationResult<PayrollEmployee> {
  const employeeCode = stringValue(form, "employeeCode").toUpperCase();
  const employeeName = stringValue(form, "employeeName");
  const hourlyRateCents = dollarsToCents(stringValue(form, "hourlyRate"));
  const default403bCents = optionalDollarsToCents(stringValue(form, "default403b")) ?? 0;
  const status = stringValue(form, "status") || "active";
  const filingStatus = stringValue(form, "filingStatus") as PayrollFilingStatus;
  const errors: Record<string, string> = {};

  if (!/^[A-Z0-9-]{2,20}$/.test(employeeCode)) errors.employeeCode = "Use 2-20 letters, numbers, or dashes.";
  if (employeeName.length < 2) errors.employeeName = "Employee name is required.";
  if (!Number.isInteger(hourlyRateCents) || hourlyRateCents <= 0) errors.hourlyRate = "Hourly rate must be greater than zero.";
  if (!Number.isInteger(default403bCents) || default403bCents < 0) errors.default403b = "403(b) amount cannot be negative.";
  if (!["active", "inactive"].includes(status)) errors.status = "Choose active or inactive.";
  if (!["single", "married", "head_of_household"].includes(filingStatus)) errors.filingStatus = "Choose a filing status.";

  const employee: PayrollEmployee = {
    id: randomId("pe"),
    organization_id: organizationId,
    employee_code: employeeCode,
    employee_name: employeeName,
    hourly_rate_cents: hourlyRateCents,
    default_403b_cents: default403bCents,
    status: status as "active" | "inactive",
    filing_status: filingStatus,
    step2_checked: boolValue(form, "step2Checked"),
    step3_credits_cents: optionalDollarsToCents(stringValue(form, "step3Credits")) ?? 0,
    step4a_other_income_cents: optionalDollarsToCents(stringValue(form, "step4aOtherIncome")) ?? 0,
    step4b_deductions_cents: optionalDollarsToCents(stringValue(form, "step4bDeductions")) ?? 0,
    step4c_extra_withholding_cents: optionalDollarsToCents(stringValue(form, "step4cExtraWithholding")) ?? 0,
    federal_exempt: boolValue(form, "federalExempt")
  };

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, data: employee };
}

export function validatePayrollEmployeeUpdateForm(form: FormData, organizationId: string): ValidationResult<PayrollEmployee> {
  const result = validatePayrollEmployeeForm(form, organizationId);
  const employeeId = stringValue(form, "employeeId");
  if (!result.ok) return result;
  if (!employeeId) return { ok: false, errors: { employee: "Choose an employee to update." } };

  return { ok: true, data: { ...result.data, id: employeeId } };
}

export function payrollEmployeesCsv(employees: PayrollEmployee[]): string {
  return toCsv(
    [
      "employee_id",
      "employee_code",
      "employee_name",
      "hourly_rate",
      "default_403b",
      "status",
      "filing_status",
      "step2_checked",
      "step3_credits",
      "step4a_other_income",
      "step4b_deductions",
      "step4c_extra_withholding",
      "federal_exempt"
    ],
    employees.map((employee) => [
      employee.id,
      employee.employee_code,
      employee.employee_name,
      centsForCsv(employee.hourly_rate_cents),
      centsForCsv(employee.default_403b_cents),
      employee.status,
      employee.filing_status,
      String(employee.step2_checked),
      centsForCsv(employee.step3_credits_cents),
      centsForCsv(employee.step4a_other_income_cents),
      centsForCsv(employee.step4b_deductions_cents),
      centsForCsv(employee.step4c_extra_withholding_cents),
      String(employee.federal_exempt)
    ])
  );
}

export function payrollEntriesCsv(entries: PayrollEntryExportRow[]): string {
  return toCsv(
    [
      "record_number",
      "pay_date",
      "period_start",
      "period_end",
      "pay_frequency",
      "employee_code",
      "employee_name",
      "hours_worked",
      "bonus_taxable",
      "gross_pay",
      "federal_withholding",
      "ohio_withholding",
      "local_tax",
      "retirement_403b",
      "employee_social_security",
      "employee_medicare",
      "employer_social_security",
      "employer_medicare",
      "net_pay",
      "employer_cost",
      "journal_entry_id"
    ],
    entries.map((entry) => [
      entry.record_number,
      entry.pay_date,
      entry.period_start,
      entry.period_end,
      entry.pay_frequency,
      entry.employee_code,
      entry.employee_name,
      (entry.hours_worked_hundredths / 100).toFixed(2),
      centsForCsv(entry.bonus_taxable_cents),
      centsForCsv(entry.gross_pay_cents),
      centsForCsv(entry.federal_withholding_cents),
      centsForCsv(entry.ohio_withholding_cents),
      centsForCsv(entry.local_tax_cents),
      centsForCsv(entry.retirement_403b_cents),
      centsForCsv(entry.employee_ssa_cents),
      centsForCsv(entry.employee_medicare_cents),
      centsForCsv(entry.employer_ssa_cents),
      centsForCsv(entry.employer_medicare_cents),
      centsForCsv(entry.net_pay_cents),
      centsForCsv(entry.employer_cost_cents),
      entry.journal_entry_id ?? ""
    ])
  );
}

export function validatePayrollEntryForm(
  form: FormData,
  employees: PayrollEmployee[],
  accounts: ChartAccount[],
  organizationId: string,
  createdByUserId: string
): ValidationResult<PayrollEntryDraft> {
  const employeeId = stringValue(form, "employeeId");
  const payDate = stringValue(form, "payDate");
  const periodStart = stringValue(form, "periodStart");
  const periodEnd = stringValue(form, "periodEnd");
  const payFrequency = stringValue(form, "payFrequency") as PayFrequency;
  const hoursWorkedHundredths = hoursToHundredths(stringValue(form, "hoursWorked"));
  const bonusTaxableCents = optionalDollarsToCents(stringValue(form, "bonusTaxable")) ?? 0;
  const override403bCents = optionalDollarsToCents(stringValue(form, "override403b"));
  const journalAccounts: PayrollJournalAccounts = {
    cashAccountId: stringValue(form, "cashAccountId"),
    wageExpenseAccountId: stringValue(form, "wageExpenseAccountId"),
    payrollTaxExpenseAccountId: stringValue(form, "payrollTaxExpenseAccountId"),
    withholdingLiabilityAccountId: stringValue(form, "withholdingLiabilityAccountId"),
    retirementLiabilityAccountId: stringValue(form, "retirementLiabilityAccountId")
  };
  const errors: Record<string, string> = {};
  const employee = employees.find((item) => item.id === employeeId);

  if (!employee || employee.status !== "active") errors.employeeId = "Choose an active employee.";
  if (!isIsoDate(payDate)) errors.payDate = "Pay date must use YYYY-MM-DD.";
  if (!isIsoDate(periodStart)) errors.periodStart = "Period start must use YYYY-MM-DD.";
  if (!isIsoDate(periodEnd)) errors.periodEnd = "Period end must use YYYY-MM-DD.";
  if (isIsoDate(periodStart) && isIsoDate(periodEnd) && periodStart > periodEnd) {
    errors.periodEnd = "Period end must be after period start.";
  }
  if (!["weekly", "biweekly", "semimonthly", "monthly"].includes(payFrequency)) {
    errors.payFrequency = "Choose a pay frequency.";
  }
  if (!Number.isInteger(hoursWorkedHundredths) || hoursWorkedHundredths < 0) {
    errors.hoursWorked = "Hours must be zero or greater.";
  }
  if (!Number.isInteger(bonusTaxableCents) || bonusTaxableCents < 0) {
    errors.bonusTaxable = "Bonus cannot be negative.";
  }
  if (override403bCents !== null && (!Number.isInteger(override403bCents) || override403bCents < 0)) {
    errors.override403b = "403(b) override cannot be negative.";
  }
  validatePayrollJournalAccounts(journalAccounts, accounts, organizationId, errors);

  return Object.keys(errors).length > 0
    ? { ok: false, errors }
    : {
        ok: true,
        data: {
          organizationId,
          createdByUserId,
          employeeId,
          payDate,
          periodStart,
          periodEnd,
          payFrequency,
          hoursWorkedHundredths,
          bonusTaxableCents,
          override403bCents,
          journalAccounts
        }
      };
}

export function buildPayrollJournalLines(
  calculation: PayrollCalculation,
  accounts: PayrollJournalAccounts,
  description: string
): JournalEntryLineInput[] {
  const withholdingCents =
    calculation.federalWithholdingCents +
    calculation.ohioWithholdingCents +
    calculation.localTaxCents +
    calculation.employeeSsaCents +
    calculation.employeeMedicareCents +
    calculation.employerSsaCents +
    calculation.employerMedicareCents;
  const lines: JournalEntryLineInput[] = [
    journalLine(accounts.wageExpenseAccountId, description, calculation.grossPayCents, 0),
    journalLine(
      accounts.payrollTaxExpenseAccountId,
      description,
      calculation.employerSsaCents + calculation.employerMedicareCents,
      0
    ),
    journalLine(accounts.cashAccountId, description, 0, calculation.netPayCents),
    journalLine(accounts.withholdingLiabilityAccountId, description, 0, withholdingCents)
  ];

  if (calculation.retirement403bCents > 0) {
    lines.push(journalLine(accounts.retirementLiabilityAccountId, description, 0, calculation.retirement403bCents));
  }

  return lines;
}

export function calculatePayroll(input: PayrollCalculationInput): PayrollCalculation {
  const periodsPerYear = periodsForFrequency(input.payFrequency);
  const grossPayCents = roundCents(input.employee.hourly_rate_cents * (input.hoursWorkedHundredths / 100) + input.bonusTaxableCents);
  const annualizedGrossCents = grossPayCents * periodsPerYear;
  const retirement403bCents = input.override403bCents ?? input.employee.default_403b_cents;
  const fitTaxableWagesCents = Math.max(0, grossPayCents - retirement403bCents);
  const standardDeductionCents = standardDeductionAdjustment(input.employee);
  const adjustedAnnualWageCents = Math.max(
    0,
    fitTaxableWagesCents * periodsPerYear +
      input.employee.step4a_other_income_cents -
      input.employee.step4b_deductions_cents -
      standardDeductionCents
  );
  const tentativeAnnualFederalTaxCents = calculateFederalAnnualTax(
    adjustedAnnualWageCents,
    input.employee.filing_status,
    input.employee.step2_checked === 1
  );
  const federalAfterCreditsCents = Math.max(0, tentativeAnnualFederalTaxCents - input.employee.step3_credits_cents);
  const federalWithholdingCents =
    input.employee.federal_exempt === 1
      ? 0
      : roundCents(federalAfterCreditsCents / periodsPerYear + input.employee.step4c_extra_withholding_cents);
  const ohioWithholdingCents = calculateOhioWithholding(grossPayCents, periodsPerYear);
  const localTaxCents = roundCents(grossPayCents * RATES.localTaxRate);
  const employeeSsaCents = socialSecurityTax(grossPayCents, input.priorYtdGrossCents, RATES.employeeSocialSecurity);
  const employeeMedicareCents = medicareTax(grossPayCents, input.priorYtdGrossCents);
  const employerSsaCents = socialSecurityTax(grossPayCents, input.priorYtdGrossCents, RATES.employerSocialSecurity);
  const employerMedicareCents = roundCents(grossPayCents * RATES.employerMedicare);
  const netPayCents =
    grossPayCents -
    federalWithholdingCents -
    ohioWithholdingCents -
    localTaxCents -
    retirement403bCents -
    employeeSsaCents -
    employeeMedicareCents;
  const employerCostCents = grossPayCents + employerSsaCents + employerMedicareCents;

  return {
    periodsPerYear,
    annualizedGrossCents,
    fitTaxableWagesCents,
    adjustedAnnualWageCents,
    tentativeAnnualFederalTaxCents,
    grossPayCents,
    federalWithholdingCents,
    ohioWithholdingCents,
    localTaxCents,
    retirement403bCents,
    employeeSsaCents,
    employeeMedicareCents,
    employerSsaCents,
    employerMedicareCents,
    netPayCents,
    employerCostCents
  };
}

export function periodsForFrequency(frequency: PayFrequency): number {
  return { weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12 }[frequency];
}

export function createPayStatementPdf(statement: PayrollPayStatement): ArrayBuffer {
  const deductions =
    statement.federal_withholding_cents +
    statement.ohio_withholding_cents +
    statement.local_tax_cents +
    statement.retirement_403b_cents +
    statement.employee_ssa_cents +
    statement.employee_medicare_cents;
  const lines = [
    { label: statement.organization_name, value: "Employee Pay Statement" },
    { label: "Record", value: statement.record_number },
    { label: "Employee", value: `${statement.employee_name} (${statement.employee_code})` },
    { label: "Pay date", value: statement.pay_date },
    { label: "Pay period", value: `${statement.period_start} to ${statement.period_end}` },
    { label: "Pay frequency", value: titleCase(statement.pay_frequency) },
    { label: "Hours worked", value: (statement.hours_worked_hundredths / 100).toFixed(2) },
    { label: "Gross pay", value: formatMoney(statement.gross_pay_cents) },
    { label: "Bonus / other taxable", value: formatMoney(statement.bonus_taxable_cents) },
    { label: "Federal withholding", value: formatMoney(statement.federal_withholding_cents) },
    { label: "Ohio withholding", value: formatMoney(statement.ohio_withholding_cents) },
    { label: "Local tax", value: formatMoney(statement.local_tax_cents) },
    { label: "403(b)", value: formatMoney(statement.retirement_403b_cents) },
    { label: "Employee Social Security", value: formatMoney(statement.employee_ssa_cents) },
    { label: "Employee Medicare", value: formatMoney(statement.employee_medicare_cents) },
    { label: "Total deductions", value: formatMoney(deductions) },
    { label: "Net pay", value: formatMoney(statement.net_pay_cents) },
    { label: "Employer Social Security", value: formatMoney(statement.employer_ssa_cents) },
    { label: "Employer Medicare", value: formatMoney(statement.employer_medicare_cents) }
  ];
  const textCommands = lines
    .map((line, index) => {
      const y = 730 - index * 28;
      const size = index === 0 ? 16 : index === 16 ? 14 : 11;
      const label = pdfText(line.label);
      const value = pdfText(line.value);
      return `BT /F1 ${size} Tf 54 ${y} Td (${label}) Tj ET\nBT /F1 ${size} Tf 330 ${y} Td (${value}) Tj ET`;
    })
    .join("\n");
  const stream = `0.12 w 54 704 m 558 704 l S\n${textCommands}`;

  return buildPdf(stream);
}

export function createPayrollTaxReportPdf(report: PayrollTaxReport, logoDataUrl: string | null): ArrayBuffer {
  const logo = logoDataUrl ? parsePdfImage(logoDataUrl) : null;
  const reportRows = report.rows.slice(0, 18);
  const headerStart = logo ? 646 : 704;
  const rowsText = reportRows
    .map((row, index) => {
      const y = 456 - index * 22;
      return [
        pdfText(row.pay_date),
        pdfText(row.employee_name),
        pdfText(formatMoney(row.federal_withholding_cents)),
        pdfText(formatMoney(row.state_withholding_cents)),
        pdfText(formatMoney(row.employer_ssa_cents)),
        pdfText(formatMoney(row.employer_medicare_cents)),
        pdfText(formatMoney(row.employer_tax_cents))
      ]
        .map((value, colIndex) => {
          const x = [54, 116, 236, 302, 368, 442, 516][colIndex];
          return `BT /F1 8 Tf ${x} ${y} Td (${value}) Tj ET`;
        })
        .join("\n");
    })
    .join("\n");
  const emptyRowsText =
    report.rows.length === 0
      ? `BT /F1 10 Tf 54 396 Td (No payroll entries matched this date range.) Tj ET`
      : "";
  const moreRows = report.rows.length > reportRows.length ? `BT /F1 8 Tf 54 92 Td (${report.rows.length - reportRows.length} additional rows not shown.) Tj ET` : "";
  const logoCommand = logo ? `q ${logo.displayWidth} 0 0 ${logo.displayHeight} 54 694 cm /Im1 Do Q` : "";
  const stream = `${logoCommand}
BT /F1 18 Tf ${logo ? 190 : 54} 742 Td (${pdfText(report.organizationName)}) Tj ET
BT /F1 14 Tf ${logo ? 190 : 54} 716 Td (Employer Payroll Tax Report) Tj ET
BT /F1 10 Tf ${logo ? 190 : 54} 696 Td (${pdfText(report.startDate)} to ${pdfText(report.endDate)}) Tj ET
0.12 w 54 ${headerStart} m 558 ${headerStart} l S
BT /F1 10 Tf 54 610 Td (Summary) Tj ET
BT /F1 9 Tf 54 584 Td (Gross payroll) Tj ET
BT /F1 9 Tf 220 584 Td (${pdfText(formatMoney(report.totals.grossPayCents))}) Tj ET
BT /F1 9 Tf 54 562 Td (Federal withholding) Tj ET
BT /F1 9 Tf 220 562 Td (${pdfText(formatMoney(report.totals.federalWithholdingCents))}) Tj ET
BT /F1 9 Tf 54 540 Td (State withholding) Tj ET
BT /F1 9 Tf 220 540 Td (${pdfText(formatMoney(report.totals.stateWithholdingCents))}) Tj ET
BT /F1 9 Tf 54 518 Td (Employer Social Security) Tj ET
BT /F1 9 Tf 220 518 Td (${pdfText(formatMoney(report.totals.employerSsaCents))}) Tj ET
BT /F1 9 Tf 54 496 Td (Employer Medicare) Tj ET
BT /F1 9 Tf 220 496 Td (${pdfText(formatMoney(report.totals.employerMedicareCents))}) Tj ET
BT /F1 11 Tf 54 470 Td (Total employer payroll tax) Tj ET
BT /F1 11 Tf 220 470 Td (${pdfText(formatMoney(report.totals.employerTaxCents))}) Tj ET
0.12 w 54 442 m 558 442 l S
BT /F1 8 Tf 54 426 Td (Date) Tj ET
BT /F1 8 Tf 116 426 Td (Employee) Tj ET
BT /F1 8 Tf 236 426 Td (Federal) Tj ET
BT /F1 8 Tf 302 426 Td (State) Tj ET
BT /F1 8 Tf 368 426 Td (ER SS) Tj ET
BT /F1 8 Tf 442 426 Td (ER Med) Tj ET
BT /F1 8 Tf 516 426 Td (ER Tax) Tj ET
${rowsText}
${emptyRowsText}
${moreRows}
BT /F1 8 Tf 54 64 Td (Prepared for accountant review. Verify rates and filings before submitting tax forms.) Tj ET`;

  return buildPdf(stream, logo ?? undefined);
}

async function priorGrossForYear(env: Env, organizationId: string, employeeId: string, payDate: string): Promise<number> {
  const year = payDate.slice(0, 4);
  const result = await env.DB.prepare(
    `SELECT COALESCE(SUM(gross_pay_cents), 0) AS priorGross
     FROM payroll_entries
     WHERE organization_id = ? AND employee_id = ? AND pay_date >= ? AND pay_date < ?`
  )
    .bind(organizationId, employeeId, `${year}-01-01`, payDate)
    .first<{ priorGross: number }>();

  return result?.priorGross ?? 0;
}

async function nextPayrollRecordNumber(
  env: Env,
  organizationId: string,
  employeeId: string,
  employeeCode: string,
  payDate: string
): Promise<string> {
  const result = await env.DB.prepare(
    `SELECT COUNT(*) + 1 AS nextNumber
     FROM payroll_entries
     WHERE organization_id = ? AND employee_id = ? AND pay_date = ?`
  )
    .bind(organizationId, employeeId, payDate)
    .first<{ nextNumber: number }>();

  return `${payDate.replaceAll("-", "")}-${employeeCode}-${String(result?.nextNumber ?? 1).padStart(3, "0")}`;
}

function calculateOhioWithholding(grossPayCents: number, periodsPerYear: number): number {
  const annualGross = grossPayCents * periodsPerYear;
  if (annualGross <= RATES.ohioLocalThresholdCents) {
    return roundCents((annualGross * 0.01775) / periodsPerYear);
  }
  if (annualGross <= 10_000_000) {
    return roundCents(((annualGross - RATES.ohioLocalThresholdCents) * 0.0299 + 46_239) / periodsPerYear);
  }

  return roundCents(((annualGross - 10_000_000) * 0.0364 + 267_350) / periodsPerYear);
}

function calculateFederalAnnualTax(
  adjustedAnnualWageCents: number,
  filingStatus: PayrollFilingStatus,
  step2Checked: boolean
): number {
  const brackets = FEDERAL_BRACKETS[filingStatus][step2Checked ? "step2" : "standard"];
  const current = brackets.reduce((selected, candidate) =>
    candidate.thresholdCents <= adjustedAnnualWageCents ? candidate : selected
  );

  return roundCents(current.baseTaxCents + (adjustedAnnualWageCents - current.thresholdCents) * current.rate);
}

function socialSecurityTax(grossPayCents: number, priorYtdGrossCents: number, rate: number): number {
  const taxableCents = Math.max(0, Math.min(grossPayCents, RATES.socialSecurityWageBaseCents - priorYtdGrossCents));
  return roundCents(taxableCents * rate);
}

function medicareTax(grossPayCents: number, priorYtdGrossCents: number): number {
  const baseTax = grossPayCents * RATES.employeeMedicare;
  const additionalTaxable =
    Math.max(0, priorYtdGrossCents + grossPayCents - RATES.additionalMedicareThresholdCents) -
    Math.max(0, priorYtdGrossCents - RATES.additionalMedicareThresholdCents);
  return roundCents(baseTax + additionalTaxable * RATES.additionalMedicare);
}

function standardDeductionAdjustment(employee: PayrollEmployee): number {
  if (employee.step2_checked === 1) return 0;
  return employee.filing_status === "married"
    ? RATES.marriedStandardDeductionAdjustmentCents
    : RATES.singleStandardDeductionAdjustmentCents;
}

function bracket(thresholdCents: number, baseTaxCents: number, rate: number): TaxBracket {
  return { thresholdCents, baseTaxCents, rate };
}

function validatePayrollJournalAccounts(
  accountIds: PayrollJournalAccounts,
  accounts: ChartAccount[],
  organizationId: string,
  errors: Record<string, string>
): void {
  validateAccountChoice(
    "cashAccountId",
    accountIds.cashAccountId,
    accounts,
    organizationId,
    ["asset", "liability"],
    "Choose the bank or cash account."
  );
  validateAccountChoice(
    "wageExpenseAccountId",
    accountIds.wageExpenseAccountId,
    accounts,
    organizationId,
    ["expense"],
    "Choose the wage expense account."
  );
  validateAccountChoice(
    "payrollTaxExpenseAccountId",
    accountIds.payrollTaxExpenseAccountId,
    accounts,
    organizationId,
    ["expense"],
    "Choose the payroll tax expense account."
  );
  validateAccountChoice(
    "withholdingLiabilityAccountId",
    accountIds.withholdingLiabilityAccountId,
    accounts,
    organizationId,
    ["liability"],
    "Choose the payroll tax liability account."
  );
  validateAccountChoice(
    "retirementLiabilityAccountId",
    accountIds.retirementLiabilityAccountId,
    accounts,
    organizationId,
    ["liability"],
    "Choose the 403(b) liability account."
  );

  function validateAccountChoice(
    key: keyof PayrollJournalAccounts,
    accountId: string,
    availableAccounts: ChartAccount[],
    expectedOrganizationId: string,
    expectedTypes: string[],
    message: string
  ): void {
    const account = availableAccounts.find((item) => item.id === accountId);
    if (!account) {
      errors[key] = message;
      return;
    }
    if (account.organization_id !== expectedOrganizationId || account.status !== "active") {
      errors[key] = "Choose an active account for this organization.";
      return;
    }
    if (!expectedTypes.includes(account.account_type)) {
      errors[key] = message;
    }
  }
}

function journalLine(
  accountId: string,
  description: string,
  debitAmountCents: number,
  creditAmountCents: number
): JournalEntryLineInput {
  return {
    accountId,
    description,
    debitAmountCents,
    creditAmountCents
  };
}

function dollarsToCents(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return Number.NaN;
  const [dollars, cents = ""] = value.split(".");
  return Number(dollars) * 100 + Number(cents.padEnd(2, "0"));
}

function optionalDollarsToCents(value: string): number | null {
  return value === "" ? null : dollarsToCents(value);
}

function hoursToHundredths(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return Number.NaN;
  const [hours, hundredths = ""] = value.split(".");
  return Number(hours) * 100 + Number(hundredths.padEnd(2, "0"));
}

function stringValue(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function boolValue(form: FormData, key: string): number {
  return form.get(key) === "on" ? 1 : 0;
}

function centsForCsv(amountCents: number): string {
  return (amountCents / 100).toFixed(2);
}

function toCsv(headers: string[], rows: string[][]): string {
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function roundCents(value: number): number {
  return Math.round(value);
}

function formatMoney(amountCents: number): string {
  const sign = amountCents < 0 ? "-" : "";
  const absolute = Math.abs(amountCents);
  return `${sign}$${(absolute / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function titleCase(value: string): string {
  return value
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function pdfText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

type PdfImage = {
  bytes: Uint8Array;
  width: number;
  height: number;
  displayWidth: number;
  displayHeight: number;
  colorSpace: "DeviceRGB";
  filter: "DCTDecode" | "FlateDecode";
  decodeParms?: string;
};

function buildPdf(stream: string, image?: PdfImage): ArrayBuffer {
  const imageResource = image ? " /XObject << /Im1 6 0 R >>" : "";
  const imageObject = image
    ? binaryObject(
        `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /${image.colorSpace} /BitsPerComponent 8 /Filter /${image.filter}${image.decodeParms ? ` /DecodeParms ${image.decodeParms}` : ""} /Length ${image.bytes.byteLength} >>`,
        image.bytes
      )
    : null;
  const objects = [
    textBytes("<< /Type /Catalog /Pages 2 0 R >>"),
    textBytes("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    textBytes(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >>${imageResource} >> /Contents 5 0 R >>`),
    textBytes("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"),
    binaryObject(`<< /Length ${asciiLength(stream)} >>`, textBytes(stream)),
    ...(imageObject ? [imageObject] : [])
  ];
  let pdf = textBytes("%PDF-1.4\n");
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(pdf.byteLength);
    pdf = concatBytes(pdf, textBytes(`${index + 1} 0 obj\n`), objects[index], textBytes("\nendobj\n"));
  }
  const xrefOffset = pdf.byteLength;
  const xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  pdf = concatBytes(pdf, textBytes(xref));

  const buffer = new ArrayBuffer(pdf.byteLength);
  new Uint8Array(buffer).set(pdf);
  return buffer;
}

function asciiLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function binaryObject(dictionary: string, bytes: Uint8Array): Uint8Array {
  return concatBytes(textBytes(`${dictionary}\nstream\n`), bytes, textBytes("\nendstream"));
}

function textBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function concatBytes(...chunks: Uint8Array[]): Uint8Array {
  const length = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function parsePdfImage(dataUrl: string): PdfImage | null {
  const match = /^data:(image\/(?:jpeg|png));base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;

  const bytes = base64Bytes(match[2]);
  if (match[1].toLowerCase() === "image/jpeg") {
    const dimensions = jpegDimensions(bytes);
    return dimensions ? pdfImage(bytes, dimensions.width, dimensions.height, "DCTDecode") : null;
  }

  const png = pngInfo(bytes);
  if (!png || png.colorType !== 2 || png.bitDepth !== 8 || png.idat.byteLength === 0) return null;
  return pdfImage(
    png.idat,
    png.width,
    png.height,
    "FlateDecode",
    `<< /Predictor 15 /Colors 3 /BitsPerComponent 8 /Columns ${png.width} >>`
  );
}

function pdfImage(
  bytes: Uint8Array,
  width: number,
  height: number,
  filter: PdfImage["filter"],
  decodeParms?: string
): PdfImage {
  const displayWidth = 108;
  const displayHeight = Math.max(36, Math.min(72, Math.round((height / width) * displayWidth)));
  return {
    bytes,
    width,
    height,
    displayWidth,
    displayHeight,
    colorSpace: "DeviceRGB",
    filter,
    decodeParms
  };
}

function base64Bytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function jpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  let index = 2;
  while (index + 9 < bytes.length) {
    if (bytes[index] !== 0xff) return null;
    const marker = bytes[index + 1];
    const length = (bytes[index + 2] << 8) | bytes[index + 3];
    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        height: (bytes[index + 5] << 8) | bytes[index + 6],
        width: (bytes[index + 7] << 8) | bytes[index + 8]
      };
    }
    index += 2 + length;
  }
  return null;
}

function pngInfo(bytes: Uint8Array): {
  width: number;
  height: number;
  bitDepth: number;
  colorType: number;
  idat: Uint8Array;
} | null {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!signature.every((byte, index) => bytes[index] === byte)) return null;
  let index = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat: Uint8Array[] = [];
  while (index + 8 <= bytes.length) {
    const length = readUint32(bytes, index);
    const type = String.fromCharCode(...bytes.slice(index + 4, index + 8));
    const dataStart = index + 8;
    const dataEnd = dataStart + length;
    if (type === "IHDR") {
      width = readUint32(bytes, dataStart);
      height = readUint32(bytes, dataStart + 4);
      bitDepth = bytes[dataStart + 8];
      colorType = bytes[dataStart + 9];
    }
    if (type === "IDAT") idat.push(bytes.slice(dataStart, dataEnd));
    if (type === "IEND") break;
    index = dataEnd + 4;
  }
  if (!width || !height) return null;
  return {
    width,
    height,
    bitDepth,
    colorType,
    idat: concatBytes(...idat)
  };
}

function readUint32(bytes: Uint8Array, index: number): number {
  return ((bytes[index] << 24) | (bytes[index + 1] << 16) | (bytes[index + 2] << 8) | bytes[index + 3]) >>> 0;
}
