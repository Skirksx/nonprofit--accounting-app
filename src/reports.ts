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
