CREATE TABLE journal_entries (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entry_number TEXT NOT NULL,
  entry_date TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'void')),
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  posted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, entry_number)
);

CREATE TABLE journal_entry_lines (
  id TEXT PRIMARY KEY,
  journal_entry_id TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  line_number INTEGER NOT NULL CHECK (line_number > 0),
  description TEXT NOT NULL DEFAULT '',
  debit_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (debit_amount_cents >= 0),
  credit_amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (credit_amount_cents >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (debit_amount_cents > 0 AND credit_amount_cents = 0)
    OR (debit_amount_cents = 0 AND credit_amount_cents > 0)
  ),
  UNIQUE (journal_entry_id, line_number)
);

CREATE INDEX idx_journal_entries_organization ON journal_entries(organization_id, status, entry_date);
CREATE INDEX idx_journal_entry_lines_entry ON journal_entry_lines(journal_entry_id, line_number);
CREATE INDEX idx_journal_entry_lines_account ON journal_entry_lines(organization_id, account_id);
