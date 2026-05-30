import { randomId } from "./crypto.ts";
import type { Env, JournalEntryStatus } from "./types.ts";

export type JournalEntryLineInput = {
  accountId: string;
  fundId?: string;
  description?: string;
  debitAmountCents: number;
  creditAmountCents: number;
};

export type JournalEntryInput = {
  organizationId: string;
  entryDate: string;
  description: string;
  createdByUserId: string;
  lines: JournalEntryLineInput[];
};

export type JournalEntryTotals = {
  totalDebitCents: number;
  totalCreditCents: number;
  isBalanced: boolean;
};

export type JournalEntryHeader = {
  id: string;
  organization_id: string;
  entry_number: string;
  entry_date: string;
  description: string;
  status: JournalEntryStatus;
  created_by_user_id: string;
  posted_at: string | null;
};

export type JournalEntrySummary = JournalEntryHeader & {
  total_debit_cents: number;
  total_credit_cents: number;
};

export type JournalEntryLineRecord = JournalEntryLineInput & {
  id: string;
  line_number: number;
};

export type JournalEntryDetail = JournalEntryHeader & {
  lines: JournalEntryLineRecord[];
};

export type JournalEntryValidationResult =
  | { ok: true; totals: JournalEntryTotals }
  | { ok: false; errors: Record<string, string>; totals: JournalEntryTotals };

export function calculateJournalTotals(lines: JournalEntryLineInput[]): JournalEntryTotals {
  const totals = lines.reduce(
    (next, line) => ({
      totalDebitCents: next.totalDebitCents + amountOrZero(line.debitAmountCents),
      totalCreditCents: next.totalCreditCents + amountOrZero(line.creditAmountCents)
    }),
    { totalDebitCents: 0, totalCreditCents: 0 }
  );

  return {
    ...totals,
    isBalanced: totals.totalDebitCents === totals.totalCreditCents
  };
}

export function validateJournalEntry(
  input: JournalEntryInput,
  options: { requireBalanced: boolean } = { requireBalanced: true }
): JournalEntryValidationResult {
  const errors: Record<string, string> = {};
  const totals = calculateJournalTotals(input.lines);

  if (!input.organizationId) errors.organizationId = "Organization is required.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.entryDate)) {
    errors.entryDate = "Entry date must use YYYY-MM-DD.";
  }
  if (input.description.trim().length < 2) errors.description = "Description is required.";
  if (!input.createdByUserId) errors.createdByUserId = "Creator is required.";
  if (input.lines.length < 2) errors.lines = "A journal entry must have at least two lines.";

  input.lines.forEach((line, index) => {
    const lineKey = `lines.${index + 1}`;
    const debit = amountOrZero(line.debitAmountCents);
    const credit = amountOrZero(line.creditAmountCents);

    if (!line.accountId) errors[`${lineKey}.accountId`] = "Account is required.";
    if (!Number.isInteger(line.debitAmountCents) || line.debitAmountCents < 0) {
      errors[`${lineKey}.debitAmountCents`] = "Debit must be a non-negative whole number of cents.";
    }
    if (!Number.isInteger(line.creditAmountCents) || line.creditAmountCents < 0) {
      errors[`${lineKey}.creditAmountCents`] = "Credit must be a non-negative whole number of cents.";
    }
    if (debit === 0 && credit === 0) {
      errors[`${lineKey}.amount`] = "Line must include a debit or a credit.";
    }
    if (debit > 0 && credit > 0) {
      errors[`${lineKey}.amount`] = "Line cannot include both a debit and a credit.";
    }
  });

  if (options.requireBalanced && !totals.isBalanced) {
    errors.balance = "Total debits must equal total credits before posting.";
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors, totals } : { ok: true, totals };
}

export async function createDraftJournalEntry(env: Env, input: JournalEntryInput): Promise<string> {
  const validation = validateJournalEntry(input, { requireBalanced: false });
  if (!validation.ok) throw new JournalEntryValidationError(validation.errors);

  const entryId = randomId("je");
  const entryNumber = await nextEntryNumber(env, input.organizationId);
  const statements = [
    env.DB.prepare(
      `INSERT INTO journal_entries (
        id,
        organization_id,
        entry_number,
        entry_date,
        description,
        status,
        created_by_user_id
      )
      VALUES (?, ?, ?, ?, ?, 'draft', ?)`
    ).bind(
      entryId,
      input.organizationId,
      entryNumber,
      input.entryDate,
      input.description.trim(),
      input.createdByUserId
    ),
    ...input.lines.map((line, index) =>
      env.DB.prepare(
        `INSERT INTO journal_entry_lines (
          id,
          journal_entry_id,
          organization_id,
          account_id,
          fund_id,
          line_number,
          description,
          debit_amount_cents,
          credit_amount_cents
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        randomId("jel"),
        entryId,
        input.organizationId,
        line.accountId,
        line.fundId ?? null,
        index + 1,
        line.description?.trim() ?? "",
        line.debitAmountCents,
        line.creditAmountCents
      )
    )
  ];

  await env.DB.batch(statements);
  return entryId;
}

export async function postJournalEntry(env: Env, organizationId: string, entryId: string): Promise<void> {
  const header = await env.DB.prepare(
    `SELECT id, organization_id, entry_number, entry_date, description, status, created_by_user_id, posted_at
     FROM journal_entries
     WHERE organization_id = ? AND id = ?`
  )
    .bind(organizationId, entryId)
    .first<JournalEntryHeader>();

  if (!header) {
    throw new JournalEntryValidationError({ entry: "Journal entry was not found." });
  }
  if (header.status !== "draft") {
    throw new JournalEntryValidationError({ status: "Only draft journal entries can be posted." });
  }

  const lines = await env.DB.prepare(
    `SELECT account_id AS accountId, fund_id AS fundId, description, debit_amount_cents AS debitAmountCents, credit_amount_cents AS creditAmountCents
     FROM journal_entry_lines
     WHERE organization_id = ? AND journal_entry_id = ?
     ORDER BY line_number ASC`
  )
    .bind(organizationId, entryId)
    .all<JournalEntryLineInput>();

  const validation = validateJournalEntry(
    {
      organizationId,
      entryDate: header.entry_date,
      description: header.description,
      createdByUserId: header.created_by_user_id,
      lines: lines.results ?? []
    },
    { requireBalanced: true }
  );

  if (!validation.ok) throw new JournalEntryValidationError(validation.errors);

  await env.DB.prepare(
    `UPDATE journal_entries
     SET status = 'posted', posted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE organization_id = ? AND id = ? AND status = 'draft'`
  )
    .bind(organizationId, entryId)
    .run();
}

export async function listJournalEntries(env: Env, organizationId: string): Promise<JournalEntrySummary[]> {
  const result = await env.DB.prepare(
    `SELECT
      journal_entries.id,
      journal_entries.organization_id,
      journal_entries.entry_number,
      journal_entries.entry_date,
      journal_entries.description,
      journal_entries.status,
      journal_entries.created_by_user_id,
      journal_entries.posted_at,
      COALESCE(SUM(journal_entry_lines.debit_amount_cents), 0) AS total_debit_cents,
      COALESCE(SUM(journal_entry_lines.credit_amount_cents), 0) AS total_credit_cents
     FROM journal_entries
     LEFT JOIN journal_entry_lines ON journal_entry_lines.journal_entry_id = journal_entries.id
     WHERE journal_entries.organization_id = ? AND journal_entries.status != 'void'
     GROUP BY journal_entries.id
     ORDER BY journal_entries.entry_date DESC, journal_entries.entry_number DESC
     LIMIT 50`
  )
    .bind(organizationId)
    .all<JournalEntrySummary>();

  return result.results ?? [];
}

export async function getJournalEntryDetail(env: Env, organizationId: string, entryId: string): Promise<JournalEntryDetail | null> {
  const header = await env.DB.prepare(
    `SELECT id, organization_id, entry_number, entry_date, description, status, created_by_user_id, posted_at
     FROM journal_entries
     WHERE organization_id = ? AND id = ?`
  )
    .bind(organizationId, entryId)
    .first<JournalEntryHeader>();

  if (!header) return null;

  const lines = await env.DB.prepare(
    `SELECT
      id,
      line_number,
      account_id AS accountId,
      fund_id AS fundId,
      description,
      debit_amount_cents AS debitAmountCents,
      credit_amount_cents AS creditAmountCents
     FROM journal_entry_lines
     WHERE organization_id = ? AND journal_entry_id = ?
     ORDER BY line_number ASC`
  )
    .bind(organizationId, entryId)
    .all<JournalEntryLineRecord>();

  return { ...header, lines: lines.results ?? [] };
}

export async function updateJournalEntry(env: Env, entryId: string, input: JournalEntryInput): Promise<void> {
  const validation = validateJournalEntry(input, { requireBalanced: true });
  if (!validation.ok) throw new JournalEntryValidationError(validation.errors);

  const statements = [
    env.DB.prepare(
      `UPDATE journal_entries
       SET entry_date = ?, description = ?, updated_at = CURRENT_TIMESTAMP
       WHERE organization_id = ? AND id = ? AND status != 'void'`
    ).bind(input.entryDate, input.description.trim(), input.organizationId, entryId),
    env.DB.prepare("DELETE FROM journal_entry_lines WHERE organization_id = ? AND journal_entry_id = ?")
      .bind(input.organizationId, entryId),
    ...input.lines.map((line, index) =>
      env.DB.prepare(
        `INSERT INTO journal_entry_lines (
          id,
          journal_entry_id,
          organization_id,
          account_id,
          fund_id,
          line_number,
          description,
          debit_amount_cents,
          credit_amount_cents
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        randomId("jel"),
        entryId,
        input.organizationId,
        line.accountId,
        line.fundId ?? null,
        index + 1,
        line.description?.trim() ?? "",
        line.debitAmountCents,
        line.creditAmountCents
      )
    )
  ];

  await env.DB.batch(statements);
}

export async function deleteJournalEntry(env: Env, organizationId: string, entryId: string): Promise<void> {
  await env.DB.prepare(
    `UPDATE journal_entries
     SET status = 'void', updated_at = CURRENT_TIMESTAMP
     WHERE organization_id = ? AND id = ?`
  )
    .bind(organizationId, entryId)
    .run();
}

export function validateManualJournalEntryForm(
  form: FormData,
  organizationId: string,
  createdByUserId: string
): JournalEntryValidationResult & { input?: JournalEntryInput } {
  const input: JournalEntryInput = {
    organizationId,
    createdByUserId,
    entryDate: stringValue(form, "entryDate"),
    description: stringValue(form, "description"),
    lines: [1, 2].map((lineNumber) => ({
      accountId: stringValue(form, `line${lineNumber}AccountId`),
      fundId: stringValue(form, `line${lineNumber}FundId`) || undefined,
      description: stringValue(form, `line${lineNumber}Description`),
      debitAmountCents: dollarsToCents(stringValue(form, `line${lineNumber}Debit`)),
      creditAmountCents: dollarsToCents(stringValue(form, `line${lineNumber}Credit`))
    }))
  };
  const result = validateJournalEntry(input, { requireBalanced: true });
  return result.ok ? { ...result, input } : result;
}

export function validateJournalEntryEditForm(
  form: FormData,
  organizationId: string,
  createdByUserId: string
): JournalEntryValidationResult & { input?: JournalEntryInput; entryId?: string } {
  const entryId = stringValue(form, "entryId");
  const lineCount = Number(stringValue(form, "lineCount"));
  const count = Number.isInteger(lineCount) && lineCount > 0 && lineCount <= 50 ? lineCount : 0;
  const input: JournalEntryInput = {
    organizationId,
    createdByUserId,
    entryDate: stringValue(form, "entryDate"),
    description: stringValue(form, "description"),
    lines: Array.from({ length: count }, (_, index) => {
      const lineNumber = index + 1;
      return {
        accountId: stringValue(form, `line${lineNumber}AccountId`),
        fundId: stringValue(form, `line${lineNumber}FundId`) || undefined,
        description: stringValue(form, `line${lineNumber}Description`),
        debitAmountCents: dollarsToCents(stringValue(form, `line${lineNumber}Debit`)),
        creditAmountCents: dollarsToCents(stringValue(form, `line${lineNumber}Credit`))
      };
    })
  };
  const result = validateJournalEntry(input, { requireBalanced: true });
  if (!entryId) {
    return {
      ok: false,
      errors: { ...(!result.ok ? result.errors : {}), entryId: "Journal entry is required." },
      totals: result.totals,
      entryId
    };
  }
  return result.ok ? { ...result, input, entryId } : { ...result, entryId };
}

export class JournalEntryValidationError extends Error {
  public readonly errors: Record<string, string>;

  constructor(errors: Record<string, string>) {
    super("Journal entry validation failed.");
    this.name = "JournalEntryValidationError";
    this.errors = errors;
  }
}

async function nextEntryNumber(env: Env, organizationId: string): Promise<string> {
  const result = await env.DB.prepare(
    `SELECT COUNT(*) + 1 AS nextNumber
     FROM journal_entries
     WHERE organization_id = ?`
  )
    .bind(organizationId)
    .first<{ nextNumber: number }>();

  return `JE-${String(result?.nextNumber ?? 1).padStart(6, "0")}`;
}

function amountOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function stringValue(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function dollarsToCents(value: string): number {
  if (value === "") return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return Number.NaN;
  const [dollars, cents = ""] = value.split(".");
  return Number(dollars) * 100 + Number(cents.padEnd(2, "0"));
}
