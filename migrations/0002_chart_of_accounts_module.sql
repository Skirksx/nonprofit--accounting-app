PRAGMA foreign_keys = OFF;

DROP INDEX IF EXISTS idx_accounts_organization;

CREATE TABLE accounts_new (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_number TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('asset', 'liability', 'net_asset', 'revenue', 'expense')),
  normal_balance TEXT NOT NULL CHECK (normal_balance IN ('debit', 'credit')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, account_number)
);

INSERT INTO accounts_new (
  id,
  organization_id,
  account_number,
  account_name,
  account_type,
  normal_balance,
  status,
  created_at,
  updated_at
)
SELECT
  id,
  organization_id,
  code,
  name,
  type,
  normal_balance,
  CASE WHEN is_active = 1 THEN 'active' ELSE 'inactive' END,
  created_at,
  updated_at
FROM accounts;

DROP TABLE accounts;
ALTER TABLE accounts_new RENAME TO accounts;

CREATE INDEX idx_accounts_organization ON accounts(organization_id, status, account_type, account_number);

PRAGMA foreign_keys = ON;
