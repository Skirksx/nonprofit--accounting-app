import { randomId } from "./crypto.ts";
import type { AccountType, Env } from "./types.ts";

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

export async function statementOfActivities(
  env: Env,
  filters: StatementOfActivitiesFilters
): Promise<StatementOfActivitiesReport> {
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
    .all<StatementOfActivitiesRow>();

  const rows = result.results ?? [];
  const revenues = rows.filter((row) => row.account_type === "revenue");
  const expenses = rows.filter((row) => row.account_type === "expense");
  const totalRevenueCents = sumRows(revenues);
  const totalExpenseCents = sumRows(expenses);

  return {
    filters,
    revenues,
    expenses,
    totalRevenueCents,
    totalExpenseCents,
    changeInNetAssetsCents: totalRevenueCents - totalExpenseCents
  };
}

function sumRows(rows: StatementOfActivitiesRow[]): number {
  return rows.reduce((total, row) => total + row.amount_cents, 0);
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
