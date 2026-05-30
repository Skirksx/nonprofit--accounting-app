ALTER TABLE organizations ADD COLUMN organization_profile TEXT NOT NULL DEFAULT 'church' CHECK (organization_profile IN ('church', 'rotary'));
