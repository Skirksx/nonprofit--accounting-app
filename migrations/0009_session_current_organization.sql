ALTER TABLE sessions ADD COLUMN current_organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL;
