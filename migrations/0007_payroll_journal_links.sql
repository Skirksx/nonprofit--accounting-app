ALTER TABLE payroll_entries ADD COLUMN journal_entry_id TEXT REFERENCES journal_entries(id);

CREATE INDEX idx_payroll_entries_journal_entry ON payroll_entries(organization_id, journal_entry_id);
