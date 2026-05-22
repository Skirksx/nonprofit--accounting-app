import type { ChartAccount } from "./accounts.ts";
import { createDraftJournalEntry, postJournalEntry } from "./journalEntries.ts";
import type { Env } from "./types.ts";
import type { ValidationResult } from "./validation.ts";

export type SimpleTransactionType = "income" | "expense";

export type SimpleTransactionInput = {
  organizationId: string;
  createdByUserId: string;
  transactionType: SimpleTransactionType;
  transactionDate: string;
  description: string;
  amountCents: number;
  cashAccountId: string;
  categoryAccountId: string;
  fundId?: string;
};

export function validateSimpleTransactionForm(
  form: FormData,
  accounts: ChartAccount[],
  organizationId: string,
  createdByUserId: string
): ValidationResult<SimpleTransactionInput> {
  const transactionType = stringValue(form, "transactionType") as SimpleTransactionType;
  const transactionDate = stringValue(form, "transactionDate");
  const description = stringValue(form, "description");
  const amount = stringValue(form, "amount");
  const cashAccountId = stringValue(form, "cashAccountId");
  const categoryAccountId = stringValue(form, "categoryAccountId");
  const fundId = stringValue(form, "fundId") || undefined;
  const amountCents = dollarsToCents(amount);
  const errors: Record<string, string> = {};

  const cashAccount = accounts.find((account) => account.id === cashAccountId);
  const categoryAccount = accounts.find((account) => account.id === categoryAccountId);

  if (!["income", "expense"].includes(transactionType)) {
    errors.transactionType = "Choose income or expense.";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(transactionDate)) {
    errors.transactionDate = "Date must use YYYY-MM-DD.";
  }
  if (description.length < 2) errors.description = "Description is required.";
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    errors.amount = "Amount must be greater than zero.";
  }
  if (!cashAccount) {
    errors.cashAccountId = "Choose a cash or bank account.";
  } else if (cashAccount.organization_id !== organizationId || cashAccount.status !== "active") {
    errors.cashAccountId = "Choose an active account for this organization.";
  } else if (!["asset", "liability"].includes(cashAccount.account_type)) {
    errors.cashAccountId = "Cash account must be an asset or liability account.";
  }
  if (!categoryAccount) {
    errors.categoryAccountId = "Choose an income or expense account.";
  } else if (categoryAccount.organization_id !== organizationId || categoryAccount.status !== "active") {
    errors.categoryAccountId = "Choose an active account for this organization.";
  } else if (transactionType === "income" && categoryAccount.account_type !== "revenue") {
    errors.categoryAccountId = "Income transactions must use a revenue account.";
  } else if (transactionType === "expense" && categoryAccount.account_type !== "expense") {
    errors.categoryAccountId = "Expense transactions must use an expense account.";
  }
  if (cashAccountId && categoryAccountId && cashAccountId === categoryAccountId) {
    errors.categoryAccountId = "Choose two different accounts.";
  }

  return Object.keys(errors).length > 0
    ? { ok: false, errors }
    : {
        ok: true,
        data: {
          organizationId,
          createdByUserId,
          transactionType,
          transactionDate,
          description,
          amountCents,
          cashAccountId,
          categoryAccountId,
          fundId
        }
      };
}

export function buildJournalLinesForSimpleTransaction(input: SimpleTransactionInput) {
  if (input.transactionType === "income") {
    return [
      journalLine(input.cashAccountId, input.description, input.amountCents, 0, input.fundId),
      journalLine(input.categoryAccountId, input.description, 0, input.amountCents, input.fundId)
    ];
  }

  return [
    journalLine(input.categoryAccountId, input.description, input.amountCents, 0, input.fundId),
    journalLine(input.cashAccountId, input.description, 0, input.amountCents, input.fundId)
  ];
}

export async function createAndPostSimpleTransaction(env: Env, input: SimpleTransactionInput): Promise<string> {
  const journalEntryId = await createDraftJournalEntry(env, {
    organizationId: input.organizationId,
    entryDate: input.transactionDate,
    description: `${titleCase(input.transactionType)}: ${input.description}`,
    createdByUserId: input.createdByUserId,
    lines: buildJournalLinesForSimpleTransaction(input)
  });

  await postJournalEntry(env, input.organizationId, journalEntryId);
  return journalEntryId;
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

function titleCase(value: string): string {
  return value[0].toUpperCase() + value.slice(1);
}

function journalLine(
  accountId: string,
  description: string,
  debitAmountCents: number,
  creditAmountCents: number,
  fundId?: string
) {
  return {
    accountId,
    ...(fundId ? { fundId } : {}),
    description,
    debitAmountCents,
    creditAmountCents
  };
}
