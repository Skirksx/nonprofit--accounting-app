import type { AccountStatus, AccountType, NormalBalance, OrganizationProfile } from "./types.ts";

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: Record<string, string> };

export function validateLogin(form: FormData): ValidationResult<{ email: string; password: string }> {
  const email = stringValue(form, "email").toLowerCase();
  const password = stringValue(form, "password");
  const errors: Record<string, string> = {};

  if (!isEmail(email)) errors.email = "Enter a valid email address.";
  if (password.length < 8) errors.password = "Password must be at least 8 characters.";

  return finish(errors, { email, password });
}

export function validateSetup(form: FormData): ValidationResult<{
  organizationName: string;
  organizationProfile: OrganizationProfile;
  fiscalYearStartMonth: number;
  name: string;
  email: string;
  password: string;
}> {
  const organizationName = stringValue(form, "organizationName");
  const organizationProfile = stringValue(form, "organizationProfile") as OrganizationProfile;
  const fiscalYearStartMonth = Number(stringValue(form, "fiscalYearStartMonth"));
  const name = stringValue(form, "name");
  const email = stringValue(form, "email").toLowerCase();
  const password = stringValue(form, "password");
  const errors: Record<string, string> = {};

  if (organizationName.length < 2) errors.organizationName = "Organization name is required.";
  if (!["church", "rotary"].includes(organizationProfile)) {
    errors.organizationProfile = "Choose church or Rotary.";
  }
  if (!Number.isInteger(fiscalYearStartMonth) || fiscalYearStartMonth < 1 || fiscalYearStartMonth > 12) {
    errors.fiscalYearStartMonth = "Choose a valid fiscal year start month.";
  }
  if (name.length < 2) errors.name = "Your name is required.";
  if (!isEmail(email)) errors.email = "Enter a valid email address.";
  if (password.length < 12) errors.password = "Use at least 12 characters for the owner password.";

  return finish(errors, { organizationName, organizationProfile, fiscalYearStartMonth, name, email, password });
}

export function validateAccount(form: FormData): ValidationResult<{
  accountNumber: string;
  accountName: string;
  accountType: AccountType;
  normalBalance: NormalBalance;
  status: AccountStatus;
}> {
  const accountNumber = stringValue(form, "accountNumber");
  const accountName = stringValue(form, "accountName");
  const accountType = stringValue(form, "accountType") as AccountType;
  const normalBalance = stringValue(form, "normalBalance") as NormalBalance;
  const status = stringValue(form, "status") as AccountStatus;
  const errors: Record<string, string> = {};

  if (!/^[0-9]{3,12}$/.test(accountNumber)) {
    errors.accountNumber = "Use a numeric account number, 3-12 digits.";
  }
  if (accountName.length < 2) errors.accountName = "Account name is required.";
  if (!["asset", "liability", "net_asset", "revenue", "expense"].includes(accountType)) {
    errors.accountType = "Choose a valid account type.";
  }
  if (!["debit", "credit"].includes(normalBalance)) {
    errors.normalBalance = "Choose debit or credit.";
  }
  if (!["active", "inactive"].includes(status)) {
    errors.status = "Choose active or inactive.";
  }

  return finish(errors, { accountNumber, accountName, accountType, normalBalance, status });
}

function stringValue(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function finish<T>(errors: Record<string, string>, data: T): ValidationResult<T> {
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, data };
}
