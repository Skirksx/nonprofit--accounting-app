import { randomId } from "./crypto.ts";
import type { AccountType, Env } from "./types.ts";
import type { ChartAccount } from "./accounts.ts";
import type { ValidationResult } from "./validation.ts";

export type Fund = {
  id: string;
  organization_id: string;
  name: string;
  status: "active" | "inactive";
};

export type StatementOfActivitiesFilters = {
  organizationId: string;
  startDate?: string;
  endDate?: string;
  fundId?: string;
};

export type StatementOfActivitiesRow = {
  account_id: string;
  account_number: string;
  account_name: string;
  account_type: AccountType;
  amount_cents: number;
};

export type StatementOfActivitiesReport = {
  filters: Required<Pick<StatementOfActivitiesFilters, "organizationId">> &
    Pick<StatementOfActivitiesFilters, "startDate" | "endDate" | "fundId">;
  revenues: StatementOfActivitiesRow[];
  expenses: StatementOfActivitiesRow[];
  totalRevenueCents: number;
  totalExpenseCents: number;
  changeInNetAssetsCents: number;
};

export type BalanceSheetFilters = {
  organizationId: string;
  asOfDate?: string;
  fundId?: string;
};

export type FinancialReportFilters = {
  organizationId: string;
  startDate?: string;
  endDate?: string;
  fundId?: string;
};

export type FinancialReportRow = {
  account_id: string;
  account_number: string;
  account_name: string;
  account_type: AccountType;
  amount_cents: number;
};

export type BalanceSheetReport = {
  filters: BalanceSheetFilters;
  assets: FinancialReportRow[];
  liabilities: FinancialReportRow[];
  netAssets: FinancialReportRow[];
  operatingChangeCents: number;
  totalAssetsCents: number;
  totalLiabilitiesCents: number;
  totalNetAssetsCents: number;
  totalLiabilitiesAndNetAssetsCents: number;
};

export type IncomeStatementReport = {
  filters: FinancialReportFilters;
  revenues: FinancialReportRow[];
  expenses: FinancialReportRow[];
  totalRevenueCents: number;
  totalExpenseCents: number;
  netIncomeCents: number;
};

export type BudgetLineInput = {
  organizationId: string;
  fiscalYear: number;
  accountId: string;
  fundId: string | null;
  amountCents: number;
};

export type BudgetLineRecord = {
  id: string;
  fiscal_year: number;
  account_id: string;
  account_number: string;
  account_name: string;
  account_type: AccountType;
  fund_id: string | null;
  fund_name: string | null;
  amount_cents: number;
};

export type BudgetReport = {
  organizationName: string;
  fiscalYear: number;
  expenses: BudgetLineRecord[];
  income: BudgetLineRecord[];
  totalExpensesCents: number;
  totalIncomeCents: number;
  netBudgetCents: number;
};

export type BudgetVsActualRow = FinancialReportRow & {
  budget_cents: number;
  actual_cents: number;
  variance_cents: number;
};

export type BudgetVsActualReport = {
  filters: FinancialReportFilters & { fiscalYear: number };
  rows: BudgetVsActualRow[];
  totalBudgetCents: number;
  totalActualCents: number;
  totalVarianceCents: number;
};

export function parseStatementOfActivitiesFilters(
  url: URL,
  organizationId: string
): StatementOfActivitiesFilters | { errors: Record<string, string> } {
  const startDate = url.searchParams.get("startDate")?.trim() || undefined;
  const endDate = url.searchParams.get("endDate")?.trim() || undefined;
  const fundId = url.searchParams.get("fundId")?.trim() || undefined;
  const errors: Record<string, string> = {};

  if (startDate && !isIsoDate(startDate)) errors.startDate = "Start date must use YYYY-MM-DD.";
  if (endDate && !isIsoDate(endDate)) errors.endDate = "End date must use YYYY-MM-DD.";
  if (startDate && endDate && startDate > endDate) {
    errors.endDate = "End date must be on or after the start date.";
  }

  if (Object.keys(errors).length > 0) return { errors };
  return { organizationId, startDate, endDate, fundId };
}

export function parseBalanceSheetFilters(
  url: URL,
  organizationId: string
): BalanceSheetFilters | { errors: Record<string, string> } {
  const asOfDate = url.searchParams.get("asOfDate")?.trim() || undefined;
  const fundId = url.searchParams.get("fundId")?.trim() || undefined;
  const errors: Record<string, string> = {};

  if (asOfDate && !isIsoDate(asOfDate)) errors.asOfDate = "As of date must use YYYY-MM-DD.";

  return Object.keys(errors).length > 0 ? { errors } : { organizationId, asOfDate, fundId };
}

export function parseFinancialReportFilters(
  url: URL,
  organizationId: string
): FinancialReportFilters | { errors: Record<string, string> } {
  const startDate = url.searchParams.get("startDate")?.trim() || undefined;
  const endDate = url.searchParams.get("endDate")?.trim() || undefined;
  const fundId = url.searchParams.get("fundId")?.trim() || undefined;
  const errors: Record<string, string> = {};

  if (startDate && !isIsoDate(startDate)) errors.startDate = "Start date must use YYYY-MM-DD.";
  if (endDate && !isIsoDate(endDate)) errors.endDate = "End date must use YYYY-MM-DD.";
  if (startDate && endDate && startDate > endDate) {
    errors.endDate = "End date must be on or after the start date.";
  }

  return Object.keys(errors).length > 0 ? { errors } : { organizationId, startDate, endDate, fundId };
}

export function parseBudgetVsActualFilters(
  url: URL,
  organizationId: string
): BudgetVsActualReport["filters"] | { errors: Record<string, string> } {
  const base = parseFinancialReportFilters(url, organizationId);
  if ("errors" in base) return base;

  const yearText = url.searchParams.get("fiscalYear")?.trim() || String(new Date().getFullYear());
  const fiscalYear = Number(yearText);
  if (!Number.isInteger(fiscalYear) || fiscalYear < 2000 || fiscalYear > 2100) {
    return { errors: { fiscalYear: "Fiscal year must be a four-digit year." } };
  }

  return { ...base, fiscalYear };
}

export async function listFunds(env: Env, organizationId: string): Promise<Fund[]> {
  const result = await env.DB.prepare(
    `SELECT id, organization_id, name, status
     FROM funds
     WHERE organization_id = ?
     ORDER BY name ASC`
  )
    .bind(organizationId)
    .all<Fund>();

  return result.results ?? [];
}

export async function createFund(env: Env, organizationId: string, name: string): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO funds (id, organization_id, name) VALUES (?, ?, ?)"
  )
    .bind(randomId("fund"), organizationId, name.trim())
    .run();
}

export async function balanceSheet(env: Env, filters: BalanceSheetFilters): Promise<BalanceSheetReport> {
  const rows = await accountBalances(env, filters, ["asset", "liability", "net_asset"]);
  const operatingChangeCents = await operatingChange(env, filters);
  const assets = rows.filter((row) => row.account_type === "asset");
  const liabilities = rows.filter((row) => row.account_type === "liability");
  const netAssets = rows.filter((row) => row.account_type === "net_asset");
  const totalAssetsCents = sumFinancialRows(assets);
  const totalLiabilitiesCents = sumFinancialRows(liabilities);
  const totalNetAssetsCents = sumFinancialRows(netAssets) + operatingChangeCents;

  return {
    filters,
    assets,
    liabilities,
    netAssets,
    operatingChangeCents,
    totalAssetsCents,
    totalLiabilitiesCents,
    totalNetAssetsCents,
    totalLiabilitiesAndNetAssetsCents: totalLiabilitiesCents + totalNetAssetsCents
  };
}

export async function incomeStatement(env: Env, filters: FinancialReportFilters): Promise<IncomeStatementReport> {
  const rows = await activityRows(env, filters);
  const revenues = rows.filter((row) => row.account_type === "revenue");
  const expenses = rows.filter((row) => row.account_type === "expense");
  const totalRevenueCents = sumFinancialRows(revenues);
  const totalExpenseCents = sumFinancialRows(expenses);

  return {
    filters,
    revenues,
    expenses,
    totalRevenueCents,
    totalExpenseCents,
    netIncomeCents: totalRevenueCents - totalExpenseCents
  };
}

export async function createBudgetLine(env: Env, input: BudgetLineInput): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO budget_lines (
      id,
      organization_id,
      fiscal_year,
      account_id,
      fund_id,
      amount_cents
    )
    VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(randomId("budget"), input.organizationId, input.fiscalYear, input.accountId, input.fundId, input.amountCents)
    .run();
}

export async function listBudgetLines(env: Env, organizationId: string, fiscalYear: number): Promise<BudgetLineRecord[]> {
  const result = await env.DB.prepare(
    `SELECT
      budget_lines.id,
      budget_lines.fiscal_year,
      accounts.id AS account_id,
      accounts.account_number,
      accounts.account_name,
      accounts.account_type,
      funds.id AS fund_id,
      funds.name AS fund_name,
      budget_lines.amount_cents
     FROM budget_lines
     JOIN accounts ON accounts.id = budget_lines.account_id
     LEFT JOIN funds ON funds.id = budget_lines.fund_id
     WHERE budget_lines.organization_id = ? AND budget_lines.fiscal_year = ?
     ORDER BY accounts.account_type ASC, funds.name ASC, accounts.account_number ASC`
  )
    .bind(organizationId, fiscalYear)
    .all<BudgetLineRecord>();

  return result.results ?? [];
}

export function validateBudgetLineUpdateForm(
  form: FormData,
  accounts: ChartAccount[],
  funds: Fund[],
  organizationId: string
): ValidationResult<BudgetLineInput & { id: string }> {
  const id = stringValue(form, "budgetLineId");
  const result = validateBudgetLineForm(form, accounts, funds, organizationId);
  if (!result.ok) return result;
  if (!id) return { ok: false, errors: { budgetLineId: "Choose a budget line." } };
  return { ok: true, data: { ...result.data, id } };
}

export async function updateBudgetLine(env: Env, input: BudgetLineInput & { id: string }): Promise<void> {
  await env.DB.prepare(
    `UPDATE budget_lines
     SET fiscal_year = ?, account_id = ?, fund_id = ?, amount_cents = ?, updated_at = CURRENT_TIMESTAMP
     WHERE organization_id = ? AND id = ?`
  )
    .bind(input.fiscalYear, input.accountId, input.fundId, input.amountCents, input.organizationId, input.id)
    .run();
}

export async function deleteBudgetLine(env: Env, organizationId: string, budgetLineId: string): Promise<void> {
  await env.DB.prepare("DELETE FROM budget_lines WHERE organization_id = ? AND id = ?")
    .bind(organizationId, budgetLineId)
    .run();
}

export function validateBudgetLineForm(
  form: FormData,
  accounts: ChartAccount[],
  funds: Fund[],
  organizationId: string
): ValidationResult<BudgetLineInput> {
  const fiscalYear = Number(stringValue(form, "fiscalYear"));
  const accountId = stringValue(form, "accountId");
  const fundId = stringValue(form, "fundId") || null;
  const amountCents = dollarsToCents(stringValue(form, "amount"));
  const account = accounts.find((item) => item.id === accountId);
  const errors: Record<string, string> = {};

  if (!Number.isInteger(fiscalYear) || fiscalYear < 2000 || fiscalYear > 2100) {
    errors.fiscalYear = "Fiscal year must be a four-digit year.";
  }
  if (!account || account.organization_id !== organizationId || !["revenue", "expense"].includes(account.account_type)) {
    errors.accountId = "Choose a revenue or expense account.";
  }
  if (fundId) {
    const fund = funds.find((item) => item.id === fundId);
    if (!fund || fund.organization_id !== organizationId || fund.status !== "active") {
      errors.fundId = "Choose an active fund.";
    }
  }
  if (!Number.isInteger(amountCents) || amountCents < 0) {
    errors.amount = "Budget amount must be zero or greater.";
  }

  return Object.keys(errors).length > 0
    ? { ok: false, errors }
    : { ok: true, data: { organizationId, fiscalYear, accountId, fundId, amountCents } };
}

export async function budgetReport(env: Env, organizationId: string, organizationName: string, fiscalYear: number): Promise<BudgetReport> {
  const rows = await listBudgetLines(env, organizationId, fiscalYear);
  const expenses = rows.filter((row) => row.account_type === "expense");
  const income = rows.filter((row) => row.account_type === "revenue");
  const totalExpensesCents = sumBudgetRows(expenses);
  const totalIncomeCents = sumBudgetRows(income);

  return {
    organizationName,
    fiscalYear,
    expenses,
    income,
    totalExpensesCents,
    totalIncomeCents,
    netBudgetCents: totalIncomeCents - totalExpensesCents
  };
}

export function createBudgetReportPdf(report: BudgetReport): ArrayBuffer {
  const operations = [
    "0.12 0.18 0.15 rg",
    pdfCenteredText(report.organizationName, 20, 748, "F2"),
    pdfCenteredText(`${report.fiscalYear - 1}-${report.fiscalYear} ANNUAL OPERATING BUDGET`, 14, 724, "F2")
  ];
  const afterExpenses = budgetReportSection(operations, "EXPENSES", report.expenses, report.totalExpensesCents, "TOTAL EXPENSES", 690);
  const afterIncome = budgetReportSection(operations, "INCOME", report.income, report.totalIncomeCents, "TOTAL INCOME", afterExpenses - 18);

  operations.push(
    pdfFillRect(42, afterIncome - 2, 528, 22, "0.88 0.93 0.90"),
    pdfStrokeRect(42, afterIncome - 2, 528, 22),
    pdfTextAt("NET BUDGET", 50, afterIncome + 5, 10, "F2"),
    pdfTextAt(formatMoney(report.netBudgetCents), 494, afterIncome + 5, 10, "F2"),
    pdfCenteredText("Service Above Self", 10, 82, "F1")
  );

  return buildSimplePdf(operations.join("\n"));
}

export async function budgetVsActual(
  env: Env,
  filters: BudgetVsActualReport["filters"]
): Promise<BudgetVsActualReport> {
  const [actualRows, budgetRows] = await Promise.all([
    activityRows(env, filters),
    budgetRowsForYear(env, filters)
  ]);
  const rowsByAccount = new Map<string, BudgetVsActualRow>();

  for (const row of budgetRows) {
    rowsByAccount.set(row.account_id, {
      ...row,
      budget_cents: row.amount_cents,
      actual_cents: 0,
      variance_cents: -row.amount_cents
    });
  }

  for (const row of actualRows) {
    const existing = rowsByAccount.get(row.account_id);
    if (existing) {
      existing.actual_cents = row.amount_cents;
      existing.variance_cents = row.amount_cents - existing.budget_cents;
    } else {
      rowsByAccount.set(row.account_id, {
        ...row,
        budget_cents: 0,
        actual_cents: row.amount_cents,
        variance_cents: row.amount_cents
      });
    }
  }

  const rows = [...rowsByAccount.values()].sort((a, b) => a.account_number.localeCompare(b.account_number));

  return {
    filters,
    rows,
    totalBudgetCents: rows.reduce((total, row) => total + row.budget_cents, 0),
    totalActualCents: rows.reduce((total, row) => total + row.actual_cents, 0),
    totalVarianceCents: rows.reduce((total, row) => total + row.variance_cents, 0)
  };
}

export async function statementOfActivities(
  env: Env,
  filters: StatementOfActivitiesFilters
): Promise<StatementOfActivitiesReport> {
  const rows = await activityRows(env, filters);
  const revenues = rows.filter((row) => row.account_type === "revenue");
  const expenses = rows.filter((row) => row.account_type === "expense");
  const totalRevenueCents = sumFinancialRows(revenues);
  const totalExpenseCents = sumFinancialRows(expenses);

  return {
    filters,
    revenues,
    expenses,
    totalRevenueCents,
    totalExpenseCents,
    changeInNetAssetsCents: totalRevenueCents - totalExpenseCents
  };
}

async function activityRows(env: Env, filters: FinancialReportFilters): Promise<FinancialReportRow[]> {
  const where = [
    "journal_entries.organization_id = ?",
    "journal_entries.status = 'posted'",
    "accounts.account_type IN ('revenue', 'expense')"
  ];
  const bindings: string[] = [filters.organizationId];

  if (filters.startDate) {
    where.push("journal_entries.entry_date >= ?");
    bindings.push(filters.startDate);
  }
  if (filters.endDate) {
    where.push("journal_entries.entry_date <= ?");
    bindings.push(filters.endDate);
  }
  if (filters.fundId) {
    where.push("journal_entry_lines.fund_id = ?");
    bindings.push(filters.fundId);
  }

  const result = await env.DB.prepare(
    `SELECT
      accounts.id AS account_id,
      accounts.account_number,
      accounts.account_name,
      accounts.account_type,
      SUM(
        CASE
          WHEN accounts.account_type = 'revenue'
            THEN journal_entry_lines.credit_amount_cents - journal_entry_lines.debit_amount_cents
          WHEN accounts.account_type = 'expense'
            THEN journal_entry_lines.debit_amount_cents - journal_entry_lines.credit_amount_cents
          ELSE 0
        END
      ) AS amount_cents
    FROM journal_entry_lines
    JOIN journal_entries ON journal_entries.id = journal_entry_lines.journal_entry_id
    JOIN accounts ON accounts.id = journal_entry_lines.account_id
    WHERE ${where.join(" AND ")}
    GROUP BY accounts.id, accounts.account_number, accounts.account_name, accounts.account_type
    ORDER BY accounts.account_type DESC, accounts.account_number ASC`
  )
    .bind(...bindings)
    .all<FinancialReportRow>();

  return result.results ?? [];
}

async function accountBalances(
  env: Env,
  filters: BalanceSheetFilters,
  accountTypes: AccountType[]
): Promise<FinancialReportRow[]> {
  const where = [
    "journal_entries.organization_id = ?",
    "journal_entries.status = 'posted'",
    `accounts.account_type IN (${accountTypes.map(() => "?").join(", ")})`
  ];
  const bindings: string[] = [filters.organizationId, ...accountTypes];

  if (filters.asOfDate) {
    where.push("journal_entries.entry_date <= ?");
    bindings.push(filters.asOfDate);
  }
  if (filters.fundId) {
    where.push("journal_entry_lines.fund_id = ?");
    bindings.push(filters.fundId);
  }

  const result = await env.DB.prepare(
    `SELECT
      accounts.id AS account_id,
      accounts.account_number,
      accounts.account_name,
      accounts.account_type,
      SUM(
        CASE
          WHEN accounts.account_type = 'asset'
            THEN journal_entry_lines.debit_amount_cents - journal_entry_lines.credit_amount_cents
          WHEN accounts.account_type IN ('liability', 'net_asset')
            THEN journal_entry_lines.credit_amount_cents - journal_entry_lines.debit_amount_cents
          ELSE 0
        END
      ) AS amount_cents
    FROM journal_entry_lines
    JOIN journal_entries ON journal_entries.id = journal_entry_lines.journal_entry_id
    JOIN accounts ON accounts.id = journal_entry_lines.account_id
    WHERE ${where.join(" AND ")}
    GROUP BY accounts.id, accounts.account_number, accounts.account_name, accounts.account_type
    ORDER BY accounts.account_type ASC, accounts.account_number ASC`
  )
    .bind(...bindings)
    .all<FinancialReportRow>();

  return result.results ?? [];
}

async function operatingChange(env: Env, filters: BalanceSheetFilters): Promise<number> {
  const report = await incomeStatement(env, {
    organizationId: filters.organizationId,
    endDate: filters.asOfDate,
    fundId: filters.fundId
  });
  return report.netIncomeCents;
}

async function budgetRowsForYear(env: Env, filters: BudgetVsActualReport["filters"]): Promise<FinancialReportRow[]> {
  const where = ["budget_lines.organization_id = ?", "budget_lines.fiscal_year = ?"];
  const bindings: Array<string | number> = [filters.organizationId, filters.fiscalYear];

  if (filters.fundId) {
    where.push("budget_lines.fund_id = ?");
    bindings.push(filters.fundId);
  }

  const result = await env.DB.prepare(
    `SELECT
      accounts.id AS account_id,
      accounts.account_number,
      accounts.account_name,
      accounts.account_type,
      SUM(budget_lines.amount_cents) AS amount_cents
    FROM budget_lines
    JOIN accounts ON accounts.id = budget_lines.account_id
    WHERE ${where.join(" AND ")}
    GROUP BY accounts.id, accounts.account_number, accounts.account_name, accounts.account_type
    ORDER BY accounts.account_number ASC`
  )
    .bind(...bindings)
    .all<FinancialReportRow>();

  return result.results ?? [];
}

function sumFinancialRows(rows: FinancialReportRow[]): number {
  return rows.reduce((total, row) => total + row.amount_cents, 0);
}

function sumBudgetRows(rows: BudgetLineRecord[]): number {
  return rows.reduce((total, row) => total + row.amount_cents, 0);
}

function budgetDescription(row: BudgetLineRecord): string {
  return row.account_name.replace(/\s+(Revenue|Expense)$/i, "");
}

function budgetReportSection(
  operations: string[],
  title: string,
  rows: BudgetLineRecord[],
  totalCents: number,
  totalLabel: string,
  topY: number
): number {
  const x = 42;
  const width = 528;
  const rowHeight = 18;
  const categoryWidth = 148;
  const descriptionWidth = 248;
  const amountWidth = width - categoryWidth - descriptionWidth;
  let y = topY;

  operations.push(
    pdfFillRect(x, y, width, 22, "0.80 0.86 0.82"),
    pdfStrokeRect(x, y, width, 22),
    pdfTextAt(title, x + 8, y + 7, 11, "F2")
  );
  y -= rowHeight;

  operations.push(
    pdfFillRect(x, y, width, rowHeight, "0.92 0.95 0.93"),
    pdfTableGrid(x, y, width, rowHeight, [categoryWidth, descriptionWidth, amountWidth]),
    pdfTextAt("Category", x + 8, y + 5, 9, "F2"),
    pdfTextAt("Description", x + categoryWidth + 8, y + 5, 9, "F2"),
    pdfTextAt("Budget Amount", x + categoryWidth + descriptionWidth + 22, y + 5, 9, "F2")
  );
  y -= rowHeight;

  for (const row of rows) {
    operations.push(
      pdfTableGrid(x, y, width, rowHeight, [categoryWidth, descriptionWidth, amountWidth]),
      pdfTextAt(row.fund_name ?? "General", x + 8, y + 5, 9, "F1"),
      pdfTextAt(budgetDescription(row), x + categoryWidth + 8, y + 5, 9, "F1"),
      pdfTextAt(formatMoney(row.amount_cents), x + categoryWidth + descriptionWidth + 44, y + 5, 9, "F1")
    );
    y -= rowHeight;
  }

  operations.push(
    pdfFillRect(x, y, width, rowHeight, "0.96 0.97 0.95"),
    pdfTableGrid(x, y, width, rowHeight, [categoryWidth, descriptionWidth, amountWidth]),
    pdfTextAt(totalLabel, x + 8, y + 5, 10, "F2"),
    pdfTextAt(formatMoney(totalCents), x + categoryWidth + descriptionWidth + 44, y + 5, 10, "F2")
  );

  return y - 28;
}

function stringValue(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function dollarsToCents(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return Number.NaN;
  const [dollars, cents = ""] = value.split(".");
  return Number(dollars) * 100 + Number(cents.padEnd(2, "0"));
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function formatMoney(amountCents: number): string {
  const sign = amountCents < 0 ? "-" : "";
  const absolute = Math.abs(amountCents);
  return `${sign}$${(absolute / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function pdfText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function pdfTextAt(value: string, x: number, y: number, size: number, font: "F1" | "F2"): string {
  return `BT /${font} ${size} Tf ${x} ${y} Td (${pdfText(value)}) Tj ET`;
}

function pdfCenteredText(value: string, size: number, y: number, font: "F1" | "F2"): string {
  const approximateWidth = value.length * size * 0.28;
  return pdfTextAt(value, Math.max(42, 306 - approximateWidth), y, size, font);
}

function pdfFillRect(x: number, y: number, width: number, height: number, color: string): string {
  return `q ${color} rg ${x} ${y} ${width} ${height} re f Q`;
}

function pdfStrokeRect(x: number, y: number, width: number, height: number): string {
  return `q 0.55 0.60 0.56 RG 0.7 w ${x} ${y} ${width} ${height} re S Q`;
}

function pdfTableGrid(x: number, y: number, width: number, height: number, columns: number[]): string {
  let cursor = x;
  const verticals = columns
    .slice(0, -1)
    .map((columnWidth) => {
      cursor += columnWidth;
      return `${cursor} ${y} m ${cursor} ${y + height} l`;
    })
    .join(" ");
  return `q 0.55 0.60 0.56 RG 0.7 w ${x} ${y} ${width} ${height} re S ${verticals} S Q`;
}

function buildSimplePdf(stream: string): ArrayBuffer {
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj",
    `6 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(pdf.length);
    pdf += `${object}\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const bytes = new Uint8Array(pdf.length);
  for (let index = 0; index < pdf.length; index += 1) bytes[index] = pdf.charCodeAt(index);
  return bytes.buffer;
}
