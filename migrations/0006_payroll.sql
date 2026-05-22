CREATE TABLE payroll_employees (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_code TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  hourly_rate_cents INTEGER NOT NULL CHECK (hourly_rate_cents >= 0),
  default_403b_cents INTEGER NOT NULL DEFAULT 0 CHECK (default_403b_cents >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  filing_status TEXT NOT NULL DEFAULT 'single' CHECK (filing_status IN ('single', 'married', 'head_of_household')),
  step2_checked INTEGER NOT NULL DEFAULT 0 CHECK (step2_checked IN (0, 1)),
  step3_credits_cents INTEGER NOT NULL DEFAULT 0 CHECK (step3_credits_cents >= 0),
  step4a_other_income_cents INTEGER NOT NULL DEFAULT 0 CHECK (step4a_other_income_cents >= 0),
  step4b_deductions_cents INTEGER NOT NULL DEFAULT 0 CHECK (step4b_deductions_cents >= 0),
  step4c_extra_withholding_cents INTEGER NOT NULL DEFAULT 0 CHECK (step4c_extra_withholding_cents >= 0),
  federal_exempt INTEGER NOT NULL DEFAULT 0 CHECK (federal_exempt IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, employee_code)
);

CREATE TABLE payroll_entries (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL REFERENCES payroll_employees(id),
  record_number TEXT NOT NULL,
  pay_date TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  pay_frequency TEXT NOT NULL CHECK (pay_frequency IN ('weekly', 'biweekly', 'semimonthly', 'monthly')),
  hours_worked_hundredths INTEGER NOT NULL CHECK (hours_worked_hundredths >= 0),
  bonus_taxable_cents INTEGER NOT NULL DEFAULT 0 CHECK (bonus_taxable_cents >= 0),
  override_403b_cents INTEGER CHECK (override_403b_cents IS NULL OR override_403b_cents >= 0),
  gross_pay_cents INTEGER NOT NULL CHECK (gross_pay_cents >= 0),
  federal_withholding_cents INTEGER NOT NULL CHECK (federal_withholding_cents >= 0),
  ohio_withholding_cents INTEGER NOT NULL CHECK (ohio_withholding_cents >= 0),
  local_tax_cents INTEGER NOT NULL CHECK (local_tax_cents >= 0),
  retirement_403b_cents INTEGER NOT NULL CHECK (retirement_403b_cents >= 0),
  employee_ssa_cents INTEGER NOT NULL CHECK (employee_ssa_cents >= 0),
  employee_medicare_cents INTEGER NOT NULL CHECK (employee_medicare_cents >= 0),
  employer_ssa_cents INTEGER NOT NULL CHECK (employer_ssa_cents >= 0),
  employer_medicare_cents INTEGER NOT NULL CHECK (employer_medicare_cents >= 0),
  net_pay_cents INTEGER NOT NULL,
  employer_cost_cents INTEGER NOT NULL CHECK (employer_cost_cents >= 0),
  prior_ytd_gross_cents INTEGER NOT NULL DEFAULT 0 CHECK (prior_ytd_gross_cents >= 0),
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, record_number)
);

CREATE INDEX idx_payroll_employees_org ON payroll_employees(organization_id, status, employee_code);
CREATE INDEX idx_payroll_entries_org ON payroll_entries(organization_id, pay_date);
CREATE INDEX idx_payroll_entries_employee_year ON payroll_entries(organization_id, employee_id, pay_date);
