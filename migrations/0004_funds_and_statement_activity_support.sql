CREATE TABLE funds (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, name)
);

INSERT INTO funds (id, organization_id, name)
SELECT 'fund_' || id, id, 'General Fund'
FROM organizations;

ALTER TABLE journal_entry_lines ADD COLUMN fund_id TEXT REFERENCES funds(id);

CREATE INDEX idx_funds_organization ON funds(organization_id, status, name);
CREATE INDEX idx_journal_entry_lines_fund ON journal_entry_lines(organization_id, fund_id);
