import { randomId } from "./crypto.ts";
import type { AccountStatus, AccountType, Env, NormalBalance } from "./types.ts";

export type ChartAccount = {
  id: string;
  organization_id: string;
  account_number: string;
  account_name: string;
  account_type: AccountType;
  normal_balance: NormalBalance;
  status: AccountStatus;
};

export type NewChartAccount = {
  organizationId: string;
  accountNumber: string;
  accountName: string;
  accountType: AccountType;
  normalBalance: NormalBalance;
  status: AccountStatus;
};

export type AccountStatusFilter = AccountStatus | "all";

export async function listAccounts(
  env: Env,
  organizationId: string,
  statusFilter: AccountStatusFilter = "active"
): Promise<ChartAccount[]> {
  const statusClause = statusFilter === "all" ? "" : " AND status = ?";
  const statement = env.DB.prepare(
    `SELECT
      id,
      organization_id,
      account_number,
      account_name,
      account_type,
      normal_balance,
      status
     FROM accounts
     WHERE organization_id = ?${statusClause}
     ORDER BY account_number ASC`
  );

  const result = statusFilter === "all"
    ? await statement.bind(organizationId).all<ChartAccount>()
    : await statement.bind(organizationId, statusFilter).all<ChartAccount>();

  return result.results ?? [];
}

export async function updateAccountStatus(
  env: Env,
  organizationId: string,
  accountId: string,
  status: AccountStatus
): Promise<void> {
  await env.DB.prepare(
    "UPDATE accounts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE organization_id = ? AND id = ?"
  )
    .bind(status, organizationId, accountId)
    .run();
}

export async function listActiveAccounts(env: Env, organizationId: string): Promise<ChartAccount[]> {
  const result = await env.DB.prepare(
    `SELECT
      id,
      organization_id,
      account_number,
      account_name,
      account_type,
      normal_balance,
      status
     FROM accounts
     WHERE organization_id = ? AND status = 'active'
     ORDER BY account_number ASC`
  )
    .bind(organizationId)
    .all<ChartAccount>();

  return result.results ?? [];
}

export async function createAccount(env: Env, account: NewChartAccount): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO accounts (
      id,
      organization_id,
      account_number,
      account_name,
      account_type,
      normal_balance,
      status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      randomId("acct"),
      account.organizationId,
      account.accountNumber,
      account.accountName,
      account.accountType,
      account.normalBalance,
      account.status
    )
    .run();
}

export async function accountStats(env: Env, organizationId: string): Promise<{
  accountCount: number;
  activeAccountCount: number;
}> {
  const stats = await env.DB.prepare(
    `SELECT
      COUNT(*) AS accountCount,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS activeAccountCount
    FROM accounts
    WHERE organization_id = ?`
  )
    .bind(organizationId)
    .first<{ accountCount: number; activeAccountCount: number | null }>();

  return {
    accountCount: stats?.accountCount ?? 0,
    activeAccountCount: stats?.activeAccountCount ?? 0
  };
}
