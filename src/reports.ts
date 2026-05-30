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

const ROTARY_LOGO_JPEG_BASE64 = [
  "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",
  "vqpWhsn2WRZ7rEsk+CU+fmo5J84wrjk5PvO1Opzbj776yt595wqWtZ6kk8yYkTSrhY1S1KSiorpwo9MWM+3VJJSVp80N+8r7",
  "TgesUrujfG+PV3Uf2dYQP7PkQx9jGemlboH+bYRfoAezPNI2/t7ZFv8AibiQe59ZG/4Qef7ZY/8AqvbIvq47duGS18tOVE45",
  "KsNyt0Se7mhwIDalLxzS28hKVhzGA4FA9ADNn/Td0kboDlTXS6sZ0pOKcZdPvf8AiZ249evp4Rrd5cPtsaB6RVa+bNqlQVcU",
  "kGVirrmCkhBdQlaQ2nubCFEFKgrI65iFEax3I4svN0K3UzKh9LTbcqF5+t7m3PrjMSJ9xbw9I2GnXM6xyzp7rJwEyhmJUurc",
  "kw5KZZflHnsNg8V1o0zQ97L+KijLJE3ANyMZwACFIw2VGcBumx1jrJ2SfvO4KzXqprxe7QlJqpyjspa0hnvEKQWu0SDz7JpC",
  "ld8+84oY8ca1YOtN86P1X2y0aifZ3FD2ymvkqYmQPrDwVjooYI9ekTrYfDTausWkNNvu8KtUW7iqTLjrtWEwXCsdosICm1d3",
  "aEgABO3AERNqVwr6rWO87Oy1NFapyCT7ZTUlSkJ81te8n4ZHrEf1/a3qRpNvbbhtFkZWHve7GS0gaUB2eQKAVJ6DAAxhQF5N",
  "2TsdN1fat3LLpk5UEH2+DDC4TKhUJ6IHZBJDEknA6A6e0I1wsnWOmBdLmTKVNtG6ZpMwsdojzUg/1E+o6eIEaXxRVuju676b",
  "2xUakww1LTvtc0t9wJQ2lTzYBUTyGeyV1jmKnVOo21MNVSkTb0rNyqwpl9lZQttY8QRzBiSNKtP7i4trsq966n1+aCJGTZlG",
  "pyVbQkqdA7o2lO0gJClKAxkrHMRNbP1V171A0WHbf4USX7vGcghY3SJhKxb+AngAcDickjj0K0M2ztN21fvqpm4Wyqwx2WVn",
  "HAAfxD5Z+/X1812FOTQcWhbK0qDoBSpJyCD4g+Mcs6IafaTa26k3nUL6LUxNrr7rlLkDUS0p1tTjhUoJSQVj3ekfm+NLeI7h",
  "poEzcNj6i+1W8yj+ICXQA0lRCQSw7kA5I5oJ6xBtKRNSrqZodqh0LC23EZCgrOQoEc858RHd6lepBOs6bBrOjHMBd5IZuLRu",
  "GUIrIwDBgDyOSuAwHn6cbV2oBp93JY3wIkCqrpkMpB5EMpwVz11nODX0EtSxbRsOnCk2lbUnTWv50yrISV46bldVH1JMZRJy",
  "ckYiNeFO5b8u3SpFWvyfemnBPONST0y3h1TCAkDcTzV3t2CeeB1MSUr3iMR6b2vqFjqu3ra8s4fZikQMqYC8QfAwvQ/TH0qo",
  "tXtriz1OWCeTm6sQWyTkj9T3/er6j5+cz15fnF7FlR/6nPPTn98Xsb6tdSEIQpSEIQpSEIQpSKNR+hr+H4iK0UKj9DX8PxEK",
  "Vi1gqSUkc/xjTtbNUtPtJrIeTc8q3MP1JhxmXpTISHJoFJSrP1Uc+avXlk8o3L08PQRzhxPcO2qN+aqftLZcmqoys9JtpUp+",
  "dQhMotA2lHeIwg+8MZ5lUQD1K1XcOj7XebRbQ3E7EIAFLlQ2QX4gHljoY8ZOTkAgyTatlpl9q6pfzCKMAtknGSMfHP0z5z56",
  "wOyKxfCTq3XqVb9Z0+olC+VKlLkztvU9U0lrttxCXWypXQJ5OHxxvxGem5sak1ab0wvq6X7kqVwKU3NzdPw3SbecYQpwFjI+",
  "dW2SO0XnmkkE88Rp9Q4ZNRNILPVqum5pA1KivofckGAVILWdqwVqwF5BwUAd5JIzEjacWXamuEzI3lTZ2WpFp06ipp7tr09f",
  "ZqQ4Vdo+w8Rja0pQScg5cRgEgbs0NtyHeMmnWm2tUjZZkA4wuVCvbsxDE46BVecb8+bIvD24wxLCydUk0IXM2rWjAxse3UHK",
  "ygAgffs8WXjxDHlzfiAKwPCbT9PrfvOo6bahWvJou2VmCumT8xhxD7W0Edju7ucd9Kk81JVkHkY6OSyZUlB55PXPWOc7ysX9",
  "79dnqvTVvtUOQmli2r6abaYbppZSVrZUEEFcikp2oewFIUDgkRmLW4pLhsByVtHiEpTgK0JMhc9PT2zM414OHZycBHPejJ80",
  "g5id7D3Np2y7Q6VqSCK3DsIrjjxRxnoSsBjPY4Tdxyrg8gwZRHdx6Pda/OLy0bnKVBeLOSDjsoD3j+KP8yHPRUg1IXEHQ1Vf",
  "RO6ZZKQSKK8sA+aBvH/tjhRtQllZPlHfNbuuz9QdN6sq0rkkakzNUeYQPZZlKjktKABTnIPoQI4FaSZtoKSMZRz5+kVh/iQW",
  "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",
  "KUhCEKV//9k="
].join("");

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
  const rotaryLogo = pdfImageFromJpeg(ROTARY_LOGO_JPEG_BASE64, 198, 146);
  const operations = [
    pdfFillRect(0, 0, 612, 792, "1 1 1"),
    pdfStrokeRect(42, 36, 528, 720, "0.00 0.23 0.47", 2),
    pdfFillRect(43, 649, 526, 106, "0.98 0.99 1"),
    pdfFillRect(43, 611, 526, 38, "0.00 0.23 0.47"),
    pdfFillRect(43, 649, 112, 106, "0.90 0.96 1"),
    pdfDiagonalLines(),
    pdfTextAt("Rotary", 336, 704, 34, "F2", "0.00 0.23 0.47"),
    pdfImageAt("Im1", 445, 680, 88, 65),
    pdfTextAt(report.organizationName, 78, 672, 16, "F1", "0.00 0.23 0.47"),
    pdfCenteredText(`${report.fiscalYear - 1}-${report.fiscalYear} ANNUAL OPERATING BUDGET`, 17, 624, "F2", "1 1 1")
  ];
  const afterExpenses = budgetReportSection(operations, "EXPENSES", report.expenses, report.totalExpensesCents, "TOTAL EXPENSES", 570, "expenses");
  const afterIncome = budgetReportSection(operations, "INCOME", report.income, report.totalIncomeCents, "TOTAL INCOME", afterExpenses - 28, "income");

  operations.push(
    pdfFillRect(62, afterIncome - 12, 488, 28, "0.00 0.23 0.47"),
    pdfTextAt("NET BUDGET", 218, afterIncome - 2, 13, "F2", "1 1 1"),
    pdfTextAt("|", 362, afterIncome - 2, 13, "F2", "1 1 1"),
    pdfTextAt(formatMoney(report.netBudgetCents), 394, afterIncome - 2, 13, "F2", "1 1 1"),
    pdfCenteredText("Service Above Self", 9, afterIncome - 26, "F3", "0.00 0.23 0.47")
  );

  return buildSimplePdf(operations.join("\n"), rotaryLogo);
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
  topY: number,
  icon: "expenses" | "income"
): number {
  const x = 62;
  const width = 488;
  const rowHeight = 14;
  const categoryWidth = 122;
  const descriptionWidth = 238;
  const amountWidth = width - categoryWidth - descriptionWidth;
  let y = topY;

  operations.push(
    ...pdfSectionIcon(x + 20, y + 13, icon),
    pdfTextAt(title, x + 48, y + 4, 19, "F2", "0.00 0.23 0.47"),
    pdfFillRect(x + 48, y - 3, width - 48, 2, "0.97 0.67 0.00")
  );
  y -= 18;

  operations.push(
    pdfFillRect(x, y, width, rowHeight, "0.00 0.23 0.47"),
    pdfTableGrid(x, y, width, rowHeight, [categoryWidth, descriptionWidth, amountWidth], "0.78 0.86 0.94"),
    pdfTextAt("Category", x + 32, y + 4, 8, "F2", "1 1 1"),
    pdfTextAt("Description", x + categoryWidth + 62, y + 4, 8, "F2", "1 1 1"),
    pdfTextAt("Budget Amount", x + categoryWidth + descriptionWidth + 32, y + 4, 8, "F2", "1 1 1")
  );
  y -= rowHeight;

  for (const row of rows) {
    operations.push(
      pdfTableGrid(x, y, width, rowHeight, [categoryWidth, descriptionWidth, amountWidth], "0.78 0.86 0.94"),
      pdfTextAt(row.fund_name ?? "General", x + 10, y + 4, 7.8, "F1", "0.10 0.12 0.14"),
      pdfTextAt(budgetDescription(row), x + categoryWidth + 10, y + 4, 7.8, "F1", "0.10 0.12 0.14"),
      pdfRightText(formatMoney(row.amount_cents), x + width - 10, y + 4, 7.8, "F1", "0.10 0.12 0.14")
    );
    y -= rowHeight;
  }

  operations.push(
    pdfFillRect(x, y, width, rowHeight, "0.88 0.94 0.98"),
    pdfTableGrid(x, y, width, rowHeight, [categoryWidth, descriptionWidth, amountWidth], "0.78 0.86 0.94"),
    pdfTextAt(totalLabel, x + categoryWidth + 10, y + 4, 8.5, "F2", "0.00 0.23 0.47"),
    pdfRightText(formatMoney(totalCents), x + width - 10, y + 4, 8.5, "F2", "0.00 0.23 0.47")
  );

  return y - 20;
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

function pdfTextAt(value: string, x: number, y: number, size: number, font: "F1" | "F2" | "F3", color = "0.10 0.12 0.14"): string {
  return `BT ${color} rg /${font} ${size} Tf ${x} ${y} Td (${pdfText(value)}) Tj ET`;
}

function pdfRightText(value: string, rightX: number, y: number, size: number, font: "F1" | "F2" | "F3", color = "0.10 0.12 0.14"): string {
  const approximateWidth = value.length * size * 0.43;
  return pdfTextAt(value, rightX - approximateWidth, y, size, font, color);
}

function pdfCenteredText(value: string, size: number, y: number, font: "F1" | "F2" | "F3", color = "0.10 0.12 0.14"): string {
  const approximateWidth = value.length * size * 0.28;
  return pdfTextAt(value, Math.max(42, 306 - approximateWidth), y, size, font, color);
}

function pdfFillRect(x: number, y: number, width: number, height: number, color: string): string {
  return `q ${color} rg ${x} ${y} ${width} ${height} re f Q`;
}

function pdfStrokeRect(x: number, y: number, width: number, height: number, color = "0.55 0.60 0.56", lineWidth = 0.7): string {
  return `q ${color} RG ${lineWidth} w ${x} ${y} ${width} ${height} re S Q`;
}

function pdfTableGrid(x: number, y: number, width: number, height: number, columns: number[], color = "0.55 0.60 0.56"): string {
  let cursor = x;
  const verticals = columns
    .slice(0, -1)
    .map((columnWidth) => {
      cursor += columnWidth;
      return `${cursor} ${y} m ${cursor} ${y + height} l`;
    })
    .join(" ");
  return `q ${color} RG 0.45 w ${x} ${y} ${width} ${height} re S ${verticals} S Q`;
}

function pdfDiagonalLines(): string {
  return [
    "q 0.88 0.94 1 RG 0.6 w",
    "50 735 m 140 755 l S",
    "50 722 m 170 755 l S",
    "450 58 m 560 88 l S",
    "470 46 m 570 74 l S",
    "Q"
  ].join(" ");
}

function pdfSectionIcon(cx: number, cy: number, icon: "expenses" | "income"): string[] {
  const base = [
    pdfCircle(cx, cy, 19, "0.00 0.23 0.47", "f"),
    `q 1 1 1 RG 1.3 w`
  ];
  if (icon === "expenses") {
    base.push(
      `${cx - 9} ${cy - 5} 17 11 re S`,
      `${cx - 5} ${cy + 6} m ${cx + 9} ${cy + 6} l S`,
      `${cx + 3} ${cy - 2} 4 4 re S`,
      "Q"
    );
  } else {
    base.push(
      `${cx - 9} ${cy - 9} m ${cx - 9} ${cy + 8} l ${cx + 10} ${cy + 8} l S`,
      `${cx - 6} ${cy - 5} m ${cx - 1} ${cy + 1} l ${cx + 4} ${cy - 2} l ${cx + 9} ${cy + 6} l S`,
      "Q"
    );
  }
  return base;
}

function pdfImageAt(name: string, x: number, y: number, width: number, height: number): string {
  return `q ${width} 0 0 ${height} ${x} ${y} cm /${name} Do Q`;
}

function pdfCircle(cx: number, cy: number, radius: number, color: string, mode: "f" | "S"): string {
  const c = Number((radius * 0.5522847498).toFixed(2));
  const r = Number(radius.toFixed(2));
  const colorOperator = mode === "f" ? "rg" : "RG";
  return [
    `q ${color} ${colorOperator}`,
    `${cx + r} ${cy} m`,
    `${cx + r} ${cy + c} ${cx + c} ${cy + r} ${cx} ${cy + r} c`,
    `${cx - c} ${cy + r} ${cx - r} ${cy + c} ${cx - r} ${cy} c`,
    `${cx - r} ${cy - c} ${cx - c} ${cy - r} ${cx} ${cy - r} c`,
    `${cx + c} ${cy - r} ${cx + r} ${cy - c} ${cx + r} ${cy} c`,
    `${mode} Q`
  ].join(" ");
}

type PdfImage = {
  bytes: Uint8Array;
  width: number;
  height: number;
};

function buildSimplePdf(stream: string, image?: PdfImage): ArrayBuffer {
  const imageResource = image ? " /XObject << /Im1 8 0 R >>" : "";
  const imageObject = image
    ? [
        binaryObject(
          `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.byteLength} >>`,
          image.bytes
        )
      ]
    : [];
  const objects = [
    textBytes("<< /Type /Catalog /Pages 2 0 R >>"),
    textBytes("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    textBytes(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >>${imageResource} >> /Contents 7 0 R >>`),
    textBytes("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"),
    textBytes("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"),
    textBytes("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>"),
    binaryObject(`<< /Length ${asciiLength(stream)} >>`, textBytes(stream)),
    ...imageObject
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

function pdfImageFromJpeg(base64: string, width: number, height: number): PdfImage {
  return { bytes: base64Bytes(base64), width, height };
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

function base64Bytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
