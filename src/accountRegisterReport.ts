import { listAccounts, type ChartAccount } from "./accounts.ts";
import { redirect, requireAuth, requireRole, validateCsrf } from "./auth.ts";
import { createDraftJournalEntry, postJournalEntry } from "./journalEntries.ts";
import { layout } from "./views.ts";
import type { AccountType, AuthContext, Env } from "./types.ts";

type AccountRegisterFilters = {
  organizationId: string;
  accountId?: string;
  startDate?: string;
  endDate?: string;
};

type AccountRegisterRow = {
  entry_id: string;
  entry_number: string;
  entry_date: string;
  entry_description: string;
  line_description: string;
  debit_amount_cents: number;
  credit_amount_cents: number;
  change_cents: number;
  running_balance_cents: number;
};

type AccountRegisterReport = {
  filters: Required<Pick<AccountRegisterFilters, "organizationId" | "accountId">> &
    Pick<AccountRegisterFilters, "startDate" | "endDate">;
  account: Pick<ChartAccount, "id" | "account_number" | "account_name" | "account_type">;
  rows: AccountRegisterRow[];
  totalDebitsCents: number;
  totalCreditsCents: number;
  endingBalanceCents: number;
};

export async function getAccountRegister(request: Request, env: Env): Promise<Response> {
  const context = await requireAuth(request, env);
  if (context instanceof Response) return context;

  const url = new URL(request.url);
  const filters = parseAccountRegisterFilters(url, context.organization.id);
  const accounts = await moneyAccounts(env, context.organization.id);
  if ("errors" in filters) return accountRegisterPage(env.APP_NAME, context, accounts, null, filters.errors);
  if (!filters.accountId) return accountRegisterPage(env.APP_NAME, context, accounts, null);

  const report = await accountRegister(env, {
    organizationId: filters.organizationId,
    accountId: filters.accountId,
    startDate: filters.startDate,
    endDate: filters.endDate
  });
  if (!report) return accountRegisterPage(env.APP_NAME, context, accounts, null, { accountId: "Choose a valid account." });

  return accountRegisterPage(env.APP_NAME, context, accounts, report);
}

export async function postAccountRegisterAdjustment(request: Request, env: Env): Promise<Response> {
  const context = await requireAuth(request, env);
  if (context instanceof Response) return context;

  const roleError = requireRole(context, "accountant");
  if (roleError) return roleError;

  const form = await request.formData();
  const csrfError = validateCsrf(request, form, context);
  if (csrfError) return csrfError;

  const accounts = await moneyAccounts(env, context.organization.id);
  const result = await validateBankBalanceAdjustment(form, env, context.organization.id, context.user.id);
  if (!result.ok) return accountRegisterPage(env.APP_NAME, context, accounts, null, result.errors);

  await createBankBalanceAdjustment(env, result.data);
  const params = new URLSearchParams({
    accountId: result.data.accountId,
    endDate: result.data.adjustmentDate
  });
  return redirect(`/reports/account-register?${params.toString()}`);
}

export async function getAccountRegisterCsv(request: Request, env: Env): Promise<Response> {
  const context = await requireAuth(request, env);
  if (context instanceof Response) return context;

  const url = new URL(request.url);
  const filters = parseAccountRegisterFilters(url, context.organization.id);
  if ("errors" in filters || !filters.accountId) return redirect("/reports/account-register");

  const report = await accountRegister(env, {
    organizationId: filters.organizationId,
    accountId: filters.accountId,
    startDate: filters.startDate,
    endDate: filters.endDate
  });
  if (!report) return redirect("/reports/account-register");

  return csvResponse(accountRegisterCsv(report), `${csvSafeFilename(report.account.account_name)}-register.csv`);
}

async function moneyAccounts(env: Env, organizationId: string): Promise<ChartAccount[]> {
  return (await listAccounts(env, organizationId)).filter(
    (account) => account.status === "active" && ["asset", "liability"].includes(account.account_type)
  );
}

type BankBalanceAdjustmentInput = {
  organizationId: string;
  createdByUserId: string;
  accountId: string;
  offsetAccountId: string;
  adjustmentDate: string;
  targetBalanceCents: number;
  currentBalanceCents: number;
  description: string;
};

async function validateBankBalanceAdjustment(
  form: FormData,
  env: Env,
  organizationId: string,
  createdByUserId: string
): Promise<
  | { ok: true; data: BankBalanceAdjustmentInput }
  | { ok: false; errors: Record<string, string> }
> {
  const accountId = stringValue(form, "accountId");
  const adjustmentDate = stringValue(form, "adjustmentDate");
  const targetBalanceCents = dollarsToCents(stringValue(form, "targetBalance"));
  const description = stringValue(form, "description") || "Bank balance adjustment";
  const accounts = await listAccounts(env, organizationId);
  const account = accounts.find((item) => item.id === accountId);
  const offsetAccount = accounts.find((item) => item.status === "active" && item.account_type === "net_asset");
  const errors: Record<string, string> = {};

  if (!account || account.organization_id !== organizationId || account.status !== "active" || account.account_type !== "asset") {
    errors.accountId = "Choose an active bank or investment asset account.";
  }
  if (!offsetAccount) {
    errors.offsetAccount = "Add an active net asset account before posting a bank balance adjustment.";
  }
  if (!isIsoDate(adjustmentDate)) {
    errors.adjustmentDate = "Adjustment date must use YYYY-MM-DD.";
  }
  if (!Number.isInteger(targetBalanceCents) || targetBalanceCents < 0) {
    errors.targetBalance = "Correct balance must be zero or greater.";
  }
  if (description.length < 2) {
    errors.description = "Description is required.";
  }

  if (Object.keys(errors).length > 0 || !account || !offsetAccount) return { ok: false, errors };

  const register = await accountRegister(env, {
    organizationId,
    accountId,
    endDate: adjustmentDate
  });
  const currentBalanceCents = register?.endingBalanceCents ?? 0;

  return {
    ok: true,
    data: {
      organizationId,
      createdByUserId,
      accountId,
      offsetAccountId: offsetAccount.id,
      adjustmentDate,
      targetBalanceCents,
      currentBalanceCents,
      description
    }
  };
}

async function createBankBalanceAdjustment(env: Env, input: BankBalanceAdjustmentInput): Promise<string | null> {
  const differenceCents = input.targetBalanceCents - input.currentBalanceCents;
  if (differenceCents === 0) return null;

  const amountCents = Math.abs(differenceCents);
  const bankLine = differenceCents > 0
    ? journalLine(input.accountId, input.description, amountCents, 0)
    : journalLine(input.accountId, input.description, 0, amountCents);
  const offsetLine = differenceCents > 0
    ? journalLine(input.offsetAccountId, input.description, 0, amountCents)
    : journalLine(input.offsetAccountId, input.description, amountCents, 0);

  const entryId = await createDraftJournalEntry(env, {
    organizationId: input.organizationId,
    entryDate: input.adjustmentDate,
    description: `Bank balance adjustment: ${input.description}`,
    createdByUserId: input.createdByUserId,
    lines: [bankLine, offsetLine]
  });

  await postJournalEntry(env, input.organizationId, entryId);
  return entryId;
}

function parseAccountRegisterFilters(
  url: URL,
  organizationId: string
): AccountRegisterFilters | { errors: Record<string, string> } {
  const accountId = url.searchParams.get("accountId")?.trim() || undefined;
  const startDate = url.searchParams.get("startDate")?.trim() || undefined;
  const endDate = url.searchParams.get("endDate")?.trim() || undefined;
  const errors: Record<string, string> = {};

  if (startDate && !isIsoDate(startDate)) errors.startDate = "Start date must use YYYY-MM-DD.";
  if (endDate && !isIsoDate(endDate)) errors.endDate = "End date must use YYYY-MM-DD.";
  if (startDate && endDate && startDate > endDate) errors.endDate = "End date must be on or after the start date.";

  return Object.keys(errors).length > 0 ? { errors } : { organizationId, accountId, startDate, endDate };
}

async function accountRegister(
  env: Env,
  filters: Required<Pick<AccountRegisterFilters, "organizationId" | "accountId">> &
    Pick<AccountRegisterFilters, "startDate" | "endDate">
): Promise<AccountRegisterReport | null> {
  const account = await env.DB.prepare(
    `SELECT id, account_number, account_name, account_type
     FROM accounts
     WHERE organization_id = ? AND id = ?`
  )
    .bind(filters.organizationId, filters.accountId)
    .first<AccountRegisterReport["account"]>();
  if (!account) return null;

  const opening = await openingBalance(env, filters, account.account_type);
  const where = [
    "journal_entries.organization_id = ?",
    "journal_entries.status = 'posted'",
    "journal_entry_lines.account_id = ?"
  ];
  const bindings: string[] = [filters.organizationId, filters.accountId];

  if (filters.startDate) {
    where.push("journal_entries.entry_date >= ?");
    bindings.push(filters.startDate);
  }
  if (filters.endDate) {
    where.push("journal_entries.entry_date <= ?");
    bindings.push(filters.endDate);
  }

  const result = await env.DB.prepare(
    `SELECT
      journal_entries.id AS entry_id,
      journal_entries.entry_number,
      journal_entries.entry_date,
      journal_entries.description AS entry_description,
      journal_entry_lines.description AS line_description,
      journal_entry_lines.debit_amount_cents,
      journal_entry_lines.credit_amount_cents
    FROM journal_entry_lines
    JOIN journal_entries ON journal_entries.id = journal_entry_lines.journal_entry_id
    WHERE ${where.join(" AND ")}
    ORDER BY journal_entries.entry_date ASC, journal_entries.entry_number ASC, journal_entry_lines.line_number ASC`
  )
    .bind(...bindings)
    .all<Omit<AccountRegisterRow, "change_cents" | "running_balance_cents">>();

  let runningBalanceCents = opening;
  const rows = (result.results ?? []).map((row) => {
    const changeCents = normalBalanceChange(account.account_type, row.debit_amount_cents, row.credit_amount_cents);
    runningBalanceCents += changeCents;
    return { ...row, change_cents: changeCents, running_balance_cents: runningBalanceCents };
  });

  return {
    filters,
    account,
    rows,
    totalDebitsCents: rows.reduce((total, row) => total + row.debit_amount_cents, 0),
    totalCreditsCents: rows.reduce((total, row) => total + row.credit_amount_cents, 0),
    endingBalanceCents: runningBalanceCents
  };
}

async function openingBalance(
  env: Env,
  filters: Required<Pick<AccountRegisterFilters, "organizationId" | "accountId">> &
    Pick<AccountRegisterFilters, "startDate" | "endDate">,
  accountType: AccountType
): Promise<number> {
  if (!filters.startDate) return 0;

  const result = await env.DB.prepare(
    `SELECT
      COALESCE(SUM(
        CASE
          WHEN ? IN ('asset', 'expense')
            THEN journal_entry_lines.debit_amount_cents - journal_entry_lines.credit_amount_cents
          ELSE journal_entry_lines.credit_amount_cents - journal_entry_lines.debit_amount_cents
        END
      ), 0) AS amount_cents
    FROM journal_entry_lines
    JOIN journal_entries ON journal_entries.id = journal_entry_lines.journal_entry_id
    WHERE journal_entries.organization_id = ?
      AND journal_entries.status = 'posted'
      AND journal_entry_lines.account_id = ?
      AND journal_entries.entry_date < ?`
  )
    .bind(accountType, filters.organizationId, filters.accountId, filters.startDate)
    .first<{ amount_cents: number }>();

  return Number(result?.amount_cents ?? 0);
}

function accountRegisterPage(
  appName: string,
  context: AuthContext,
  accounts: ChartAccount[],
  report: AccountRegisterReport | null,
  errors: Record<string, string> = {}
): Response {
  const selectedAccountId = report?.filters.accountId ?? "";
  const selectedDate = report?.filters.endDate ?? new Date().toISOString().slice(0, 10);
  return layout({
    title: "Account Register",
    appName,
    context,
    body: `<section class="page-heading">
        <p class="eyebrow">${escapeHtml(context.organization.name)}</p>
        <h1>Account Register</h1>
        <p class="muted">Deposits, payments, and running balance for one money account.</p>
      </section>
      ${reportNav()}
      <form method="get" action="/reports/account-register" class="grid-form report-filter">
        <label>Account
          <select name="accountId">${accountOptions(accounts, report?.filters.accountId)}</select>
          ${errorText(errors.accountId)}
        </label>
        ${dateField("Start date", "startDate", errors.startDate, report?.filters.startDate)}
        ${dateField("End date", "endDate", errors.endDate, report?.filters.endDate)}
        <div class="form-actions">
          ${report ? `<a class="button-like" href="${escapeHtml(accountRegisterCsvUrl(report))}">Download CSV</a>` : ""}
          <button type="submit">Run report</button>
        </div>
      </form>
      ${bankBalanceAdjustmentForm(context, accounts, selectedAccountId, selectedDate, errors)}
      ${report ? accountRegisterSummary(report) : ""}`
  });
}

function bankBalanceAdjustmentForm(
  context: AuthContext,
  accounts: ChartAccount[],
  selectedAccountId: string,
  selectedDate: string,
  errors: Record<string, string>
): string {
  const assetAccounts = accounts.filter((account) => account.account_type === "asset");
  return `<form method="post" action="/reports/account-register/adjust" class="grid-form report-filter">
    <input type="hidden" name="csrfToken" value="${escapeHtml(context.csrfToken)}">
    <h2>Adjust bank balance</h2>
    <p class="muted">Set the correct statement balance for a bank or investment account. The app posts only the difference as a balanced adjustment.</p>
    ${errors.offsetAccount ? `<p class="alert">${escapeHtml(errors.offsetAccount)}</p>` : ""}
    <label>Bank account
      <select name="accountId">${accountOptions(assetAccounts, selectedAccountId)}</select>
      ${errorText(errors.accountId)}
    </label>
    <label>Adjustment date
      <input name="adjustmentDate" type="date" value="${escapeHtml(selectedDate)}" required>
      ${errorText(errors.adjustmentDate)}
    </label>
    <label>Correct bank balance
      <input name="targetBalance" inputmode="decimal" placeholder="0.00" required>
      ${errorText(errors.targetBalance)}
    </label>
    <label>Description
      <input name="description" type="text" value="Bank statement balance adjustment" required>
      ${errorText(errors.description)}
    </label>
    <div class="form-actions">
      <button type="submit">Post adjustment</button>
    </div>
  </form>`;
}

function accountRegisterSummary(report: AccountRegisterReport): string {
  return `<section class="content-band report-section">
    <div class="metric-grid">
      <article class="metric"><span>Account</span><strong>${escapeHtml(report.account.account_number)} - ${escapeHtml(report.account.account_name)}</strong></article>
      <article class="metric"><span>Deposits / debits</span><strong>${formatMoney(report.totalDebitsCents)}</strong></article>
      <article class="metric"><span>Payments / credits</span><strong>${formatMoney(report.totalCreditsCents)}</strong></article>
      <article class="metric"><span>Ending balance</span><strong>${formatMoney(report.endingBalanceCents)}</strong></article>
    </div>
    <div class="table-wrap report-table">
      <table>
        <thead><tr><th>Date</th><th>Entry</th><th>Description</th><th>Deposit / debit</th><th>Payment / credit</th><th>Running balance</th></tr></thead>
        <tbody>${accountRegisterRows(report.rows)}</tbody>
      </table>
    </div>
  </section>`;
}

function accountRegisterRows(rows: AccountRegisterRow[]): string {
  if (rows.length === 0) return `<tr><td colspan="6" class="empty">No posted transactions for this account in the selected dates.</td></tr>`;
  return rows
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.entry_date)}</td>
        <td>${escapeHtml(row.entry_number)}</td>
        <td>${escapeHtml(row.line_description || row.entry_description)}</td>
        <td class="amount">${row.debit_amount_cents > 0 ? formatMoney(row.debit_amount_cents) : ""}</td>
        <td class="amount">${row.credit_amount_cents > 0 ? formatMoney(row.credit_amount_cents) : ""}</td>
        <td class="amount">${formatMoney(row.running_balance_cents)}</td>
      </tr>`
    )
    .join("");
}

function accountOptions(accounts: ChartAccount[], selectedAccountId = ""): string {
  if (accounts.length === 0) return `<option value="">No active bank or liability accounts</option>`;
  return accounts
    .map((account) => {
      const selected = account.id === selectedAccountId ? " selected" : "";
      return `<option value="${escapeHtml(account.id)}"${selected}>${escapeHtml(account.account_number)} - ${escapeHtml(account.account_name)}</option>`;
    })
    .join("");
}

function reportNav(): string {
  return `<nav class="report-nav" aria-label="Financial reports">
    <a href="/reports/balance-sheet">Balance Sheet</a>
    <a href="/reports/account-register">Account Register</a>
    <a href="/reports/income-statement">Income Statement</a>
    <a href="/reports/statement-of-activities">Statement of Activities</a>
    <a href="/budget">Budget</a>
    <a href="/reports/budget-vs-actual">Budget vs Actual</a>
  </nav>`;
}

function accountRegisterCsv(report: AccountRegisterReport): string {
  return toCsv(
    ["date", "entry_number", "description", "debit", "credit", "change", "running_balance"],
    report.rows.map((row) => [
      row.entry_date,
      row.entry_number,
      row.line_description || row.entry_description,
      row.debit_amount_cents > 0 ? centsForCsv(row.debit_amount_cents) : "",
      row.credit_amount_cents > 0 ? centsForCsv(row.credit_amount_cents) : "",
      centsForCsv(row.change_cents),
      centsForCsv(row.running_balance_cents)
    ])
  );
}

function dateField(label: string, name: string, error?: string, value = ""): string {
  return `<label>${escapeHtml(label)}
    <input name="${escapeHtml(name)}" type="date" value="${escapeHtml(value)}">
    ${errorText(error)}
  </label>`;
}

function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function accountRegisterCsvUrl(report: AccountRegisterReport): string {
  const params = new URLSearchParams();
  params.set("accountId", report.filters.accountId);
  if (report.filters.startDate) params.set("startDate", report.filters.startDate);
  if (report.filters.endDate) params.set("endDate", report.filters.endDate);
  return `/reports/account-register.csv?${params.toString()}`;
}

function normalBalanceChange(accountType: AccountType, debitCents: number, creditCents: number): number {
  return accountType === "asset" || accountType === "expense" ? debitCents - creditCents : creditCents - debitCents;
}

function journalLine(accountId: string, description: string, debitAmountCents: number, creditAmountCents: number) {
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

function stringValue(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function formatMoney(amountCents: number): string {
  const sign = amountCents < 0 ? "-" : "";
  const absolute = Math.abs(amountCents);
  return `${sign}$${(absolute / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

function csvSafeFilename(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "account";
}

function errorText(error?: string): string {
  return error ? `<span class="field-error">${escapeHtml(error)}</span>` : "";
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
