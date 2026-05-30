import "dotenv/config";

import fs from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required. Put your Neon connection string in .env or set it before running this import.");
}

const dataPath = process.env.ROTARY_IMPORT_DATA ?? path.resolve("imports/rotary-workbook-data.json");
const rawData = await fs.readFile(dataPath, "utf8");
const data = JSON.parse(rawData);
const pool = new Pool({ connectionString, ssl: connectionString.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined });

try {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const user = await findImportUser(client);
    const organizationId = await ensureOrganization(client, data, user.id);
    const funds = await ensureFunds(client, organizationId, data);
    const accounts = await ensureAccounts(client, organizationId, buildAccounts(data));

    await importOpeningBalances(client, organizationId, funds, accounts, data);
    await importTransactions(client, organizationId, funds, accounts, data);
    await importBudget(client, organizationId, funds, accounts, data);

    await client.query("COMMIT");
    console.log(`Imported ${data.organizationName} for ${user.email}.`);
    console.log(`Transactions imported/skipped safely: ${data.transactions.length}`);
    console.log(`Budget lines replaced: ${data.budget.length}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}

async function findImportUser(client) {
  const email = process.env.IMPORT_USER_EMAIL;
  if (email) {
    const result = await client.query(
      "SELECT id, email FROM users WHERE lower(email) = lower($1) LIMIT 1",
      [email]
    );
    if (result.rows[0]) return result.rows[0];
    throw new Error(`No user was found for IMPORT_USER_EMAIL=${email}`);
  }

  const result = await client.query(
    "SELECT id, email FROM users ORDER BY created_at ASC LIMIT 2"
  );
  if (result.rows.length === 1) return result.rows[0];
  if (result.rows.length === 0) throw new Error("No users exist yet. Create your first login before importing Rotary data.");
  throw new Error("More than one user exists. Set IMPORT_USER_EMAIL to choose who owns the Rotary organization.");
}

async function ensureOrganization(client, importData, userId) {
  const existing = await client.query(
    `SELECT organizations.id
     FROM organizations
     JOIN organization_members ON organization_members.organization_id = organizations.id
     WHERE organization_members.user_id = $1 AND organizations.name = $2
     LIMIT 1`,
    [userId, importData.organizationName]
  );
  const organizationId = existing.rows[0]?.id ?? deterministicId("org", importData.organizationName);

  if (!existing.rows[0]) {
    await client.query(
      `INSERT INTO organizations (id, name, fiscal_year_start_month, base_currency, organization_profile)
       VALUES ($1, $2, $3, 'USD', 'rotary')`,
      [organizationId, importData.organizationName, importData.fiscalYearStartMonth]
    );
    await client.query(
      "INSERT INTO organization_members (organization_id, user_id, role) VALUES ($1, $2, 'owner') ON CONFLICT DO NOTHING",
      [organizationId, userId]
    );
  } else {
    await client.query(
      "UPDATE organizations SET organization_profile = 'rotary', fiscal_year_start_month = $1 WHERE id = $2",
      [importData.fiscalYearStartMonth, organizationId]
    );
  }

  return organizationId;
}

async function ensureFunds(client, organizationId, importData) {
  const fundNames = new Set(["General Fund", ...importData.budget.map((line) => line.category || "General Fund")]);
  const funds = new Map();
  for (const name of fundNames) {
    const id = deterministicId("fund", organizationId, name);
    await client.query(
      `INSERT INTO funds (id, organization_id, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (organization_id, name) DO UPDATE SET status = 'active', updated_at = CURRENT_TIMESTAMP`,
      [id, organizationId, name]
    );
    const result = await client.query(
      "SELECT id, name FROM funds WHERE organization_id = $1 AND name = $2",
      [organizationId, name]
    );
    funds.set(name, result.rows[0]);
  }
  return funds;
}

function buildAccounts(importData) {
  const accounts = [
    { number: "1000", name: "CNB Bank Account", type: "asset", normalBalance: "debit" },
    { number: "1010", name: "Edward Jones", type: "asset", normalBalance: "debit" },
    { number: "3000", name: "Opening Net Assets", type: "net_asset", normalBalance: "credit" }
  ];

  importData.liabilities.forEach((line, index) => {
    accounts.push({
      number: String(2100 + index * 10),
      name: normalizeName(line.name),
      type: "liability",
      normalBalance: "credit"
    });
  });

  const revenueNames = uniqueNames([
    ...importData.transactions.filter((line) => line.category.startsWith("Revenue:")).map((line) => categoryName(line.category)),
    ...importData.budget.filter((line) => line.type.toLowerCase() === "income").map((line) => line.item)
  ]);
  revenueNames.forEach((name, index) => {
    accounts.push({
      number: String(4000 + index * 10),
      name: `${name} Revenue`,
      type: "revenue",
      normalBalance: "credit"
    });
  });

  const expenseNames = uniqueNames([
    ...importData.transactions.filter((line) => line.category.startsWith("Expense:")).map((line) => categoryName(line.category)),
    ...importData.budget.filter((line) => line.type.toLowerCase() === "expense").map((line) => line.item)
  ]);
  expenseNames.forEach((name, index) => {
    accounts.push({
      number: String(5000 + index * 10),
      name: `${name} Expense`,
      type: "expense",
      normalBalance: "debit"
    });
  });

  return accounts;
}

async function ensureAccounts(client, organizationId, accountInputs) {
  const accounts = new Map();
  for (const account of accountInputs) {
    const id = deterministicId("acct", organizationId, account.number);
    await client.query(
      `INSERT INTO accounts (id, organization_id, account_number, account_name, account_type, normal_balance, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'active')
       ON CONFLICT (organization_id, account_number)
       DO UPDATE SET account_name = $4, account_type = $5, normal_balance = $6, status = 'active', updated_at = CURRENT_TIMESTAMP`,
      [id, organizationId, account.number, account.name, account.type, account.normalBalance]
    );
    const result = await client.query(
      "SELECT id FROM accounts WHERE organization_id = $1 AND account_number = $2",
      [organizationId, account.number]
    );
    accounts.set(accountKey(account.type, account.name), { ...account, id: result.rows[0].id });
  }
  return accounts;
}

async function importOpeningBalances(client, organizationId, funds, accounts, importData) {
  const generalFundId = requiredFund(funds, "General Fund").id;
  const transactionTotalCents = importData.transactions.reduce((total, line) => total + line.amountCents, 0);
  const cnbTargetCents = requiredAsset(importData, "CNB Bank Account").amountCents;
  const cnbOpeningCents = cnbTargetCents - transactionTotalCents;
  const openingNetAssetsCents = importData.netAssetsCents - transactionTotalCents;
  const lines = [];

  for (const asset of importData.assets) {
    const amount = asset.name === "CNB Bank Account" ? cnbOpeningCents : asset.amountCents;
    addSignedNormalBalanceLine(lines, requiredAccount(accounts, "asset", asset.name).id, normalizeName(asset.name), amount, "debit");
  }
  for (const liability of importData.liabilities) {
    if (liability.amountCents === 0) continue;
    addSignedNormalBalanceLine(lines, requiredAccount(accounts, "liability", normalizeName(liability.name)).id, normalizeName(liability.name), liability.amountCents, "credit");
  }
  addSignedNormalBalanceLine(lines, requiredAccount(accounts, "net_asset", "Opening Net Assets").id, "Opening Net Assets", openingNetAssetsCents, "credit");

  await insertPostedJournalEntry(client, organizationId, "ROTARY-OPENING-2025", "2025-01-01", "Calculated opening balances from Rotary workbook", generalFundId, lines);
}

async function importTransactions(client, organizationId, funds, accounts, importData) {
  const bank = requiredAccount(accounts, "asset", "CNB Bank Account");
  const generalFundId = requiredFund(funds, "General Fund").id;
  for (const transaction of importData.transactions) {
    const amount = Math.abs(transaction.amountCents);
    if (amount === 0) continue;

    const isExpense = transaction.category.startsWith("Expense:");
    const accountType = isExpense ? "expense" : "revenue";
    const account = requiredAccount(accounts, accountType, `${categoryName(transaction.category)} ${accountType === "expense" ? "Expense" : "Revenue"}`);
    const lines = transaction.amountCents >= 0
      ? [
          { accountId: bank.id, description: transaction.description, debit: amount, credit: 0 },
          { accountId: account.id, description: transaction.description, debit: isExpense ? 0 : 0, credit: isExpense ? amount : amount }
        ]
      : [
          { accountId: account.id, description: transaction.description, debit: isExpense ? amount : amount, credit: 0 },
          { accountId: bank.id, description: transaction.description, debit: 0, credit: amount }
        ];

    await insertPostedJournalEntry(
      client,
      organizationId,
      `ROTARY-BANK-${String(transaction.sourceRow).padStart(4, "0")}`,
      transaction.date,
      `${transaction.description} - ${transaction.category}`,
      generalFundId,
      lines
    );
  }
}

async function importBudget(client, organizationId, funds, accounts, importData) {
  await client.query("DELETE FROM budget_lines WHERE organization_id = $1 AND fiscal_year = $2", [
    organizationId,
    importData.budgetFiscalYear
  ]);

  for (const line of importData.budget) {
    const accountType = line.type.toLowerCase() === "income" ? "revenue" : "expense";
    const accountName = `${line.item} ${accountType === "revenue" ? "Revenue" : "Expense"}`;
    const account = requiredAccount(accounts, accountType, accountName);
    const fund = requiredFund(funds, line.category || "General Fund");
    await client.query(
      `INSERT INTO budget_lines (id, organization_id, fiscal_year, account_id, fund_id, amount_cents)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        deterministicId("budget", organizationId, importData.budgetFiscalYear, line.sourceRow, account.id),
        organizationId,
        importData.budgetFiscalYear,
        account.id,
        fund.id,
        line.amountCents
      ]
    );
  }
}

async function insertPostedJournalEntry(client, organizationId, entryNumber, entryDate, description, fundId, lines) {
  const existing = await client.query(
    "SELECT id FROM journal_entries WHERE organization_id = $1 AND entry_number = $2",
    [organizationId, entryNumber]
  );
  if (existing.rows[0]) return;

  const journalEntryId = deterministicId("je", organizationId, entryNumber);
  await client.query(
    `INSERT INTO journal_entries (id, organization_id, entry_number, entry_date, description, status, created_by_user_id, posted_at)
     SELECT $1, $2, $3, $4, $5, 'posted', organization_members.user_id, CURRENT_TIMESTAMP
     FROM organization_members
     WHERE organization_members.organization_id = $2
     ORDER BY organization_members.created_at ASC
     LIMIT 1`,
    [journalEntryId, organizationId, entryNumber, entryDate, description]
  );

  for (const [index, line] of lines.entries()) {
    if (line.debit === 0 && line.credit === 0) continue;
    await client.query(
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
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        deterministicId("jel", journalEntryId, index + 1),
        journalEntryId,
        organizationId,
        line.accountId,
        fundId,
        index + 1,
        line.description,
        line.debit,
        line.credit
      ]
    );
  }
}

function addSignedNormalBalanceLine(lines, accountId, description, amountCents, normalBalance) {
  if (amountCents === 0) return;
  const positive = amountCents > 0;
  lines.push({
    accountId,
    description,
    debit: (normalBalance === "debit" ? positive : !positive) ? Math.abs(amountCents) : 0,
    credit: (normalBalance === "credit" ? positive : !positive) ? Math.abs(amountCents) : 0
  });
}

function requiredAccount(accounts, type, name) {
  const account = accounts.get(accountKey(type, normalizeName(name)));
  if (!account) throw new Error(`Missing ${type} account: ${name}`);
  return account;
}

function requiredFund(funds, name) {
  const fund = funds.get(name);
  if (!fund) throw new Error(`Missing fund: ${name}`);
  return fund;
}

function requiredAsset(importData, name) {
  const asset = importData.assets.find((line) => normalizeName(line.name) === name);
  if (!asset) throw new Error(`Missing balance sheet asset: ${name}`);
  return asset;
}

function accountKey(type, name) {
  return `${type}:${normalizeName(name).toLowerCase()}`;
}

function categoryName(category) {
  return normalizeName(category.replace(/^(Revenue|Expense):/i, ""));
}

function normalizeName(value) {
  return value.replace(/\s+/g, " ").trim().replace(/^Defferred/i, "Deferred");
}

function uniqueNames(names) {
  return [...new Set(names.map(normalizeName).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function deterministicId(prefix, ...parts) {
  const source = parts.join("_").toLowerCase();
  const slug = source.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 70);
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }
  return `${prefix}_${slug}_${hash.toString(16)}`;
}
