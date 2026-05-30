import { accountStats, createAccount, listAccounts } from "./accounts.ts";
import { attemptLogin, logout, redirect, requireAuth, requireRole, validateCsrf } from "./auth.ts";
import { hashPassword, randomId } from "./crypto.ts";
import {
  createDraftJournalEntry,
  listJournalEntries,
  postJournalEntry,
  validateManualJournalEntryForm
} from "./journalEntries.ts";
import {
  createPayStatementPdf,
  createPayrollTaxReportPdf,
  deletePayrollEmployee,
  createPayrollEmployee,
  createPayrollEntry,
  getPayrollPayStatement,
  listPayrollEntryExportRows,
  listPayrollEmployees,
  listPayrollEntries,
  payrollEmployeesCsv,
  payrollEntriesCsv,
  payrollImportTemplateCsv,
  payrollTaxReport,
  payrollSummary,
  updatePayrollEmployee,
  validatePayrollCsvImport,
  validatePayrollEntryForm
} from "./payroll.ts";
import {
  balanceSheet,
  budgetVsActual,
  createBudgetLine,
  createFund,
  incomeStatement,
  listFunds,
  parseBalanceSheetFilters,
  parseBudgetVsActualFilters,
  parseFinancialReportFilters,
  parseStatementOfActivitiesFilters,
  statementOfActivities,
  validateBudgetLineForm
} from "./reports.ts";
import {
  logoFileToDataUrl,
  updateOrganizationProfile,
  updateOrganizationLogo,
  updateUserName,
  updateUserPassword,
  validateOrganizationProfile,
  validatePasswordFields,
  validateProfileName
} from "./settings.ts";
import { styles } from "./styles.ts";
import { createAndPostSimpleTransaction, validateSimpleTransactionForm } from "./transactions.ts";
import type { Env, RouteHandler } from "./types.ts";
import { validateAccount, validateLogin, validateSetup } from "./validation.ts";
import {
  accountsPage,
  balanceSheetPage,
  budgetVsActualPage,
  dashboardPage,
  fundsPage,
  incomeStatementPage,
  journalEntryPage,
  loginPage,
  organizationAlreadyConfiguredPage,
  payrollPage,
  settingsPage,
  statementOfActivitiesPage,
  setupPage,
  transactionEntryPage
} from "./views.ts";

const routes: Array<{ method: string; path: string; handler: RouteHandler }> = [
  { method: "GET", path: "/", handler: () => redirect("/dashboard") },
  { method: "GET", path: "/login", handler: getLogin },
  { method: "POST", path: "/login", handler: postLogin },
  { method: "POST", path: "/logout", handler: postLogout },
  { method: "GET", path: "/setup", handler: getSetup },
  { method: "POST", path: "/setup", handler: postSetup },
  { method: "GET", path: "/dashboard", handler: getDashboard },
  { method: "GET", path: "/accounts", handler: getAccounts },
  { method: "POST", path: "/accounts", handler: postAccounts },
  { method: "GET", path: "/funds", handler: getFunds },
  { method: "POST", path: "/funds", handler: postFunds },
  { method: "GET", path: "/journal-entries/new", handler: getNewJournalEntry },
  { method: "POST", path: "/journal-entries", handler: postJournalEntries },
  { method: "GET", path: "/payroll", handler: getPayroll },
  { method: "GET", path: "/payroll/paystatement", handler: getPayrollPayStatementPdf },
  { method: "GET", path: "/payroll/reports/employer-taxes.pdf", handler: getPayrollTaxReportPdf },
  { method: "GET", path: "/payroll/export/employees.csv", handler: getPayrollEmployeesCsv },
  { method: "GET", path: "/payroll/export/payroll.csv", handler: getPayrollEntriesCsv },
  { method: "GET", path: "/payroll/import/template.csv", handler: getPayrollImportTemplateCsv },
  { method: "POST", path: "/payroll/employees", handler: postPayrollEmployees },
  { method: "POST", path: "/payroll/employees/update", handler: postPayrollEmployeeUpdate },
  { method: "POST", path: "/payroll/employees/delete", handler: postPayrollEmployeeDelete },
  { method: "POST", path: "/payroll/entries", handler: postPayrollEntries },
  { method: "POST", path: "/payroll/import/payroll.csv", handler: postPayrollCsvImport },
  { method: "GET", path: "/settings", handler: getSettings },
  { method: "POST", path: "/settings/profile", handler: postSettingsProfile },
  { method: "POST", path: "/settings/organization-profile", handler: postSettingsOrganizationProfile },
  { method: "POST", path: "/settings/password", handler: postSettingsPassword },
  { method: "POST", path: "/settings/logo", handler: postSettingsLogo },
  { method: "GET", path: "/reports/balance-sheet", handler: getBalanceSheet },
  { method: "GET", path: "/reports/income-statement", handler: getIncomeStatement },
  { method: "GET", path: "/reports/budget-vs-actual", handler: getBudgetVsActual },
  { method: "POST", path: "/reports/budget-lines", handler: postBudgetLines },
  { method: "GET", path: "/reports/statement-of-activities", handler: getStatementOfActivities },
  { method: "GET", path: "/transactions/new", handler: getNewTransaction },
  { method: "POST", path: "/transactions", handler: postTransaction },
  { method: "GET", path: "/assets/styles.css", handler: getStyles }
];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const route = routes.find((item) => item.method === request.method && item.path === url.pathname);

    if (!route) {
      return new Response("Not found", { status: 404 });
    }

    try {
      return await route.handler(request, env, {});
    } catch (error) {
      console.error(error);
      return new Response("Something went wrong", { status: 500 });
    }
  }
};

function getLogin(_request: Request, env: Env): Response {
  return loginPage(env.APP_NAME);
}

async function postLogin(request: Request, env: Env): Promise<Response> {
  const form = await request.formData();
  const result = validateLogin(form);
  if (!result.ok) return loginPage(env.APP_NAME, "Check your email and password.");

  const login = await attemptLogin(env, result.data.email, result.data.password, shouldUseSecureCookie(request));
  if (!login) return loginPage(env.APP_NAME, "Check your email and password.");

  return redirect("/dashboard", login.cookie);
}

async function postLogout(request: Request, env: Env): Promise<Response> {
  const context = await requireAuth(request, env);
  if (context instanceof Response) return context;

  const form = await request.formData();
  const csrfError = validateCsrf(request, form, context);
  if (csrfError) return csrfError;

  return logout(request, env);
}

async function getSetup(_request: Request, env: Env): Promise<Response> {
  if (await hasOrganization(env)) return organizationAlreadyConfiguredPage(env.APP_NAME);
  return setupPage(env.APP_NAME);
}

async function postSetup(request: Request, env: Env): Promise<Response> {
  if (await hasOrganization(env)) return organizationAlreadyConfiguredPage(env.APP_NAME);

  const form = await request.formData();
  const result = validateSetup(form);
  if (!result.ok) return setupPage(env.APP_NAME, result.errors);

  const password = await hashPassword(result.data.password);
  const organizationId = randomId("org");
  const userId = randomId("usr");

  const batch = [
    env.DB.prepare(
      "INSERT INTO organizations (id, name, fiscal_year_start_month, base_currency, organization_profile) VALUES (?, ?, ?, ?, ?)"
    ).bind(organizationId, result.data.organizationName, result.data.fiscalYearStartMonth, "USD", result.data.organizationProfile),
    env.DB.prepare(
      "INSERT INTO users (id, email, name, password_hash, password_salt, password_iterations) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(userId, result.data.email, result.data.name, password.hash, password.salt, password.iterations),
    env.DB.prepare(
      "INSERT INTO organization_members (organization_id, user_id, role) VALUES (?, ?, ?)"
    ).bind(organizationId, userId, "owner"),
    env.DB.prepare(
      "INSERT INTO funds (id, organization_id, name) VALUES (?, ?, ?)"
    ).bind(`fund_${organizationId}`, organizationId, "General Fund")
  ];

  await env.DB.batch(batch);

  const login = await attemptLogin(env, result.data.email, result.data.password, shouldUseSecureCookie(request));
  return redirect("/dashboard", login?.cookie);
}

async function getDashboard(request: Request, env: Env): Promise<Response> {
  const context = await requireAuth(request, env);
  if (context instanceof Response) return context;

  return dashboardPage(env.APP_NAME, context, await accountStats(env, context.organization.id));
}

async function getAccounts(request: Request, env: Env): Promise<Response> {
  const context = await requireAuth(request, env);
  if (context instanceof Response) return context;

  const accounts = await listAccounts(env, context.organization.id);
  return accountsPage(env.APP_NAME, context, accounts);
}

async function postAccounts(request: Request, env: Env): Promise<Response> {
  const context = await requireAuth(request, env);
  if (context instanceof Response) return context;

  const roleError = requireRole(context, "accountant");
  if (roleError) return roleError;

  const form = await request.formData();
  const csrfError = validateCsrf(request, form, context);
  if (csrfError) return csrfError;

  const result = validateAccount(form);
  if (!result.ok) {
    const accounts = await listAccounts(env, context.organization.id);
    return accountsPage(env.APP_NAME, context, accounts, result.errors);
  }

  try {
    await createAccount(env, {
      organizationId: context.organization.id,
      accountNumber: result.data.accountNumber,
      accountName: result.data.accountName,
      accountType: result.data.accountType,
      normalBalance: result.data.normalBalance,
      status: result.data.status
    });
  } catch (error) {
    const accounts = await listAccounts(env, context.organization.id);
    return accountsPage(env.APP_NAME, context, accounts, {
      accountNumber: "That account number already exists for this organization."
    });
  }

  return redirect("/accounts");
}

async function getFunds(request: Request, env: Env): Promise<Response> {
  const context = await requireAuth(request, env);
  if (context instanceof Response) return context;

  const funds = await listFunds(env, context.organization.id);
  return fundsPage(env.APP_NAME, context, funds);
}

async function postFunds(request: Request, env: Env): Promise<Response> {
  const context = await requireAuth(request, env);
  if (context instanceof Response) return context;

  const roleError = requireRole(context, "admin");
  if (roleError) return roleError;

  const form = await request.formData();
  const csrfError = validateCsrf(request, form, context);
  if (csrfError) return csrfError;

  const name = String(form.get("name") ?? "").trim();
  if (name.length < 2) {
    return fundsPage(env.APP_NAME, context, await listFunds(env, context.organization.id), {
      name: "Fund name is required."
    });
  }

  try {
    await createFund(env, context.organization.id, name);
  } catch (error) {
    return fundsPage(env.APP_NAME, context, await listFunds(env, context.organization.id), {
      name: "That fund already exists."
    });
  }

  return redirect("/funds");
}

async function getNewJournalEntry(request: Request, env: Env): Promise<Response> {
  const context = await requireAuth(request, env);
  if (context instanceof Response) return context;

  const roleError = requireRole(context, "accountant");
  if (roleError) return roleError;

  const [accounts, funds, entries] = await Promise.all([
    listAccounts(env, context.organization.id),
    listFunds(env, context.organization.id),
    listJournalEntries(env, context.organization.id)
  ]);

  return journalEntryPage(env.APP_NAME, context, accounts, funds, entries);
}

async function postJournalEntries(request: Request, env: Env): Promise<Response> {
  const context = await requireAuth(request, env);
  if (context instanceof Response) return context;

  const roleError = requireRole(context, "accountant");
  if (roleError) return roleError;

  const form = await request.formData();
  const csrfError = validateCsrf(request, form, context);
  if (csrfError) return csrfError;

  const [accounts, funds, entries] = await Promise.all([
    listAccounts(env, context.organization.id),
    listFunds(env, context.organization.id),
    listJournalEntries(env, context.organization.id)
  ]);
  const result = validateManualJournalEntryForm(form, context.organization.id, context.user.id);
  if (!result.ok || !result.input) {
    return journalEntryPage(env.APP_NAME, context, accounts, funds, entries, "Journal entry must be balanced and complete.");
  }

  const entryId = await createDraftJournalEntry(env, result.input);
  await postJournalEntry(env, context.organization.id, entryId);
  return redirect("/journal-entries/new");
}

async function getPayroll(request: Request, env: Env): Promise<Response> {
  const context = await requireAuth(request, env);
  if (context instanceof Response) return context;
  if (context.organization.organization_profile === "rotary") return redirect("/dashboard");

  const year = new Date().getFullYear();
  const [employees, accounts, entries, summary] = await Promise.all([
    listPayrollEmployees(env, context.organization.id),
    listAccounts(env, context.organization.id),
    listPayrollEntries(env, context.organization.id),
    payrollSummary(env, context.organization.id, year)
  ]);

  return payrollPage(env.APP_NAME, context, employees, accounts, entries, summary);
}

async function postPayrollEmployees(request: Request, env: Env): Promise<Response> {
  const context = await requireAuth(request, env);
  if (context instanceof Response) return context;
  if (context.organization.organization_profile === "rotary") return redirect("/dashboard");

  const roleError = requireRole(context, "admin");
  if (roleError) return roleError;

  const form = await request.formData();
  const csrfError = validateCsrf(request, form, context);
  if (csrfError) return csrfError;

  const result = await createPayrollEmployee(env, context.organization.id, form);
  if (!result.ok) {
    const year = new Date().getFullYear();
    const [employees, accounts, entries, summary] = await Promise.all([
      listPayrollEmployees(env, context.organization.id),
      listAccounts(env, context.organization.id),
      listPayrollEntries(env, context.organization.id),
      payrollSummary(env, context.organization.id, year)
    ]);
    return payrollPage(env.APP_NAME, context, employees, accounts, entries, summary, result.errors);
  }

  return redirect("/payroll");
}

async function postPayrollEntries(request: Request, env: Env): Promise<Response> {
  const context = await requireAuth(request, env);
  if (context instanceof Response) return context;
  if (context.organization.organization_profile === "rotary") return redirect("/dashboard");

  const roleError = requireRole(context, "accountant");
  if (roleError) return roleError;

  const form = await request.formData();
  const csrfError = validateCsrf(request, form, context);
  if (csrfError) return csrfError;

  const [employees, accounts] = await Promise.all([
    listPayrollEmployees(env, context.organization.id),
    listAccounts(env, context.organization.id)
  ]);
  const result = validatePayrollEntryForm(form, employees, accounts, context.organization.id, context.user.id);
  if (!result.ok) return payrollPageWithErrors(env, context, result.errors);

  const entry = await createPayrollEntry(env, result.data, employees);
  if (!entry.ok) return payrollPageWithErrors(env, context, entry.errors);

  return redirect("/payroll");
}

async function postPayrollCsvImport(request: Request, env: Env): Promise<Response> {
  const context = await requireAuth(request, env);
  if (context instanceof Response) return context;
  if (context.organization.organization_profile === "rotary") return redirect("/dashboard");

  const roleError = requireRole(context, "accountant");
  if (roleError) return roleError;

  const form = await request.formData();
  const csrfError = validateCsrf(request, form, context);
  if (csrfError) return csrfError;

  const file = form.get("payrollCsv");
  if (!(file instanceof File) || file.size === 0) {
    return payrollPageWithErrors(env, context, { payroll: "Choose a payroll CSV file to upload." });
  }
  if (file.size > 128_000) {
    return payrollPageWithErrors(env, context, { payroll: "Payroll CSV file must be 128 KB or smaller." });
  }

  const [employees, accounts, csvText] = await Promise.all([
    listPayrollEmployees(env, context.organization.id),
    listAccounts(env, context.organization.id),
    file.text()
  ]);
  const result = validatePayrollCsvImport(csvText, form, employees, accounts, context.organization.id, context.user.id);
  if (!result.ok) return payrollPageWithErrors(env, context, result.errors);

  for (const item of result.data) {
    const entry = await createPayrollEntry(env, item.draft, employees);
    if (!entry.ok) {
      return payrollPageWithErrors(env, context, {
        payroll: `Row ${item.rowNumber} could not be created. ${Object.values(entry.errors).join(" ")}`
      });
    }
  }

  return redirect("/payroll");
}

async function postPayrollEmployeeUpdate(request: Request, env: Env): Promise<Response> {
  const context = await requireAuth(request, env);
  if (context instanceof Response) return context;
  if (context.organization.organization_profile === "rotary") return redirect("/dashboard");

  const roleError = requireRole(context, "admin");
  if (roleError) return roleError;

  const form = await request.formData();
  const csrfError = validateCsrf(request, form, context);
  if (csrfError) return csrfError;

  const result = await updatePayrollEmployee(env, context.organization.id, form);
  if (!result.ok) return payrollPageWithErrors(env, context, result.errors);

  return redirect("/payroll");
}

async function postPayrollEmployeeDelete(request: Request, env: Env): Promise<Response> {
  const context = await requireAuth(request, env);
  if (context instanceof Response) return context;
  if (context.organization.organization_profile === "rotary") return redirect("/dashboard");

  const roleError = requireRole(context, "admin");
  if (roleError) return roleError;

  const form = await request.formData();
  const csrfError = validateCsrf(request, form, context);
  if (csrfError) return csrfError;

  await deletePayrollEmployee(env, context.organization.id, String(form.get("employeeId") ?? ""));
  return redirect("/payroll");
}

async function getPayrollPayStatementPdf(request: Request, env: Env): Promise<Response> {
  const context = await requireAuth(request, env);
  if (context instanceof Response) return context;
  if (context.organization.organization_profile === "rotary") return redirect("/dashboard");

  const roleError = requireRole(context, "accountant");
  if (roleError) return roleError;

  const url = new URL(request.url);
  const entryId = url.searchParams.get("id") ?? "";
  if (!entryId) return new Response("Pay statement was not found.", { status: 404 });

  const statement = await getPayrollPayStatement(env, context.organization.id, entryId);
  if (!statement) return new Response("Pay statement was not found.", { status: 404 });

  const pdf = createPayStatementPdf(statement);
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${statement.record_number}-paystatement.pdf"`,
      "X-Content-Type-Options": "nosniff"
    }
  });
}

async function getPayrollEmployeesCsv(request: Request, env: Env): Promise<Response> {
  const context = await requireAuth(request, env);
  if (context instanceof Response) return context;
  if (context.organization.organization_profile === "rotary") return redirect("/dashboard");

  const roleError = requireRole(context, "accountant");
  if (roleError) return roleError;

  const csv = payrollEmployeesCsv(await listPayrollEmployees(env, context.organization.id));
  return csvResponse(csv, "payroll-employees.csv");
}

async function getPayrollEntriesCsv(request: Request, env: Env): Promise<Response> {
  const context = await requireAuth(request, env);
  if (context instanceof Response) return context;
  if (context.organization.organization_profile === "rotary") return redirect("/dashboard");

  const roleError = requireRole(context, "accountant");
  if (roleError) return roleError;

  const csv = payrollEntriesCsv(await listPayrollEntryExportRows(env, context.organization.id));
  return csvResponse(csv, "payroll-entries.csv");
}

async function getPayrollImportTemplateCsv(request: Request, env: Env): Promise<Response> {
  const context = await requireAuth(request, env);
  if (context instanceof Response) return context;
  if (context.organization.organization_profile === "rotary") return redirect("/dashboard");

  const roleError = requireRole(context, "accountant");
  if (roleError) return roleError;

  return csvResponse(payrollImportTemplateCsv(), "payroll-import-template.csv");
}

async function getPayrollTaxReportPdf(request: Request, env: Env): Promise<Response> {
  const context = await requireAuth(request, env);
  if (context instanceof Response) return context;
  if (context.organization.organization_profile === "rotary") return redirect("/dashboard");

  const roleError = requireRole(context, "accountant");
  if (roleError) return roleError;

  const url = new URL(request.url);
  const startDate = url.searchParams.get("startDate") ?? "";
  const endDate = url.searchParams.get("endDate") ?? "";
  const dateError = validateReportDates(startDate, endDate);
  if (dateError) return payrollPageWithErrors(env, context, dateError);

  const report = await payrollTaxReport(env, context.organization.id, context.organization.name, startDate, endDate);
  const pdf = createPayrollTaxReportPdf(report, context.organization.logo_data_url);
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="payroll-tax-report-${startDate}-to-${endDate}.pdf"`,
      "X-Content-Type-Options": "nosniff"
    }
  });
}

async function getSettings(request: Request, env: Env): Promise<Response> {
  const context = await requireAuth(request, env);
  if (context instanceof Response) return context;

  return settingsPage(env.APP_NAME, context);
}

async function postSettingsProfile(request: Request, env: Env): Promise<Response> {
  const context = await requireAuth(request, env);
  if (context instanceof Response) return context;

  const form = await request.formData();
  const csrfError = validateCsrf(request, form, context);
  if (csrfError) return csrfError;

  const result = validateProfileName(form);
  if (!result.ok) return settingsPage(env.APP_NAME, context, result.errors);

  await updateUserName(env, context.user.id, result.data.name);
  return redirect("/settings");
}

async function postSettingsOrganizationProfile(request: Request, env: Env): Promise<Response> {
  const context = await requireAuth(request, env);
  if (context instanceof Response) return context;

  const roleError = requireRole(context, "admin");
  if (roleError) return roleError;

  const form = await request.formData();
  const csrfError = validateCsrf(request, form, context);
  if (csrfError) return csrfError;

  const result = validateOrganizationProfile(form);
  if (!result.ok) return settingsPage(env.APP_NAME, context, result.errors);

  await updateOrganizationProfile(env, context.organization.id, result.data.organizationProfile);
  return redirect("/settings");
}

async function postSettingsPassword(request: Request, env: Env): Promise<Response> {
  const context = await requireAuth(request, env);
  if (context instanceof Response) return context;

  const form = await request.formData();
  const csrfError = validateCsrf(request, form, context);
  if (csrfError) return csrfError;

  const result = validatePasswordFields(form);
  if (!result.ok) return settingsPage(env.APP_NAME, context, result.errors);

  const update = await updateUserPassword(env, context.user.id, result.data.currentPassword, result.data.newPassword);
  if (!update.ok) return settingsPage(env.APP_NAME, context, update.errors);

  return redirect("/settings");
}

async function postSettingsLogo(request: Request, env: Env): Promise<Response> {
  const context = await requireAuth(request, env);
  if (context instanceof Response) return context;

  const roleError = requireRole(context, "admin");
  if (roleError) return roleError;

  const form = await request.formData();
  const csrfError = validateCsrf(request, form, context);
  if (csrfError) return csrfError;

  const logo = form.get("logo");
  if (!(logo instanceof File)) {
    return settingsPage(env.APP_NAME, context, { logo: "Choose an image file." });
  }

  const result = await logoFileToDataUrl(logo);
  if (!result.ok) return settingsPage(env.APP_NAME, context, result.errors);

  await updateOrganizationLogo(env, context.organization.id, result.data.logoDataUrl);
  return redirect("/settings");
}

async function getBalanceSheet(request: Request, env: Env): Promise<Response> {
  const context = await requireAuth(request, env);
  if (context instanceof Response) return context;

  const url = new URL(request.url);
  const filters = parseBalanceSheetFilters(url, context.organization.id);
  const funds = await listFunds(env, context.organization.id);
  if ("errors" in filters) return balanceSheetPage(env.APP_NAME, context, funds, null, filters.errors);

  const report = await balanceSheet(env, filters);
  return balanceSheetPage(env.APP_NAME, context, funds, report);
}

async function getIncomeStatement(request: Request, env: Env): Promise<Response> {
  const context = await requireAuth(request, env);
  if (context instanceof Response) return context;

  const url = new URL(request.url);
  const filters = parseFinancialReportFilters(url, context.organization.id);
  const funds = await listFunds(env, context.organization.id);
  if ("errors" in filters) return incomeStatementPage(env.APP_NAME, context, funds, null, filters.errors);

  const report = await incomeStatement(env, filters);
  return incomeStatementPage(env.APP_NAME, context, funds, report);
}

async function getBudgetVsActual(request: Request, env: Env): Promise<Response> {
  const context = await requireAuth(request, env);
  if (context instanceof Response) return context;

  const url = new URL(request.url);
  const filters = parseBudgetVsActualFilters(url, context.organization.id);
  const [funds, accounts] = await Promise.all([
    listFunds(env, context.organization.id),
    listAccounts(env, context.organization.id)
  ]);
  if ("errors" in filters) return budgetVsActualPage(env.APP_NAME, context, funds, accounts, null, filters.errors);

  const report = await budgetVsActual(env, filters);
  return budgetVsActualPage(env.APP_NAME, context, funds, accounts, report);
}

async function postBudgetLines(request: Request, env: Env): Promise<Response> {
  const context = await requireAuth(request, env);
  if (context instanceof Response) return context;

  const roleError = requireRole(context, "accountant");
  if (roleError) return roleError;

  const form = await request.formData();
  const csrfError = validateCsrf(request, form, context);
  if (csrfError) return csrfError;

  const [funds, accounts] = await Promise.all([
    listFunds(env, context.organization.id),
    listAccounts(env, context.organization.id)
  ]);
  const result = validateBudgetLineForm(form, accounts, funds, context.organization.id);
  if (!result.ok) {
    const year = Number(form.get("fiscalYear") ?? new Date().getFullYear());
    const report = await budgetVsActual(env, {
      organizationId: context.organization.id,
      fiscalYear: Number.isInteger(year) ? year : new Date().getFullYear()
    });
    return budgetVsActualPage(env.APP_NAME, context, funds, accounts, report, result.errors);
  }

  await createBudgetLine(env, result.data);
  return redirect(`/reports/budget-vs-actual?fiscalYear=${result.data.fiscalYear}`);
}

async function getNewTransaction(request: Request, env: Env): Promise<Response> {
  const context = await requireAuth(request, env);
  if (context instanceof Response) return context;

  const roleError = requireRole(context, "accountant");
  if (roleError) return roleError;

  const accounts = await listAccounts(env, context.organization.id);
  const funds = await listFunds(env, context.organization.id);
  return transactionEntryPage(env.APP_NAME, context, accounts, funds);
}

async function postTransaction(request: Request, env: Env): Promise<Response> {
  const context = await requireAuth(request, env);
  if (context instanceof Response) return context;

  const roleError = requireRole(context, "accountant");
  if (roleError) return roleError;

  const form = await request.formData();
  const csrfError = validateCsrf(request, form, context);
  if (csrfError) return csrfError;

  const accounts = await listAccounts(env, context.organization.id);
  const funds = await listFunds(env, context.organization.id);
  const result = validateSimpleTransactionForm(form, accounts, context.organization.id, context.user.id);
  if (!result.ok) {
    return transactionEntryPage(env.APP_NAME, context, accounts, funds, result.errors);
  }

  try {
    await createAndPostSimpleTransaction(env, result.data);
  } catch (error) {
    return transactionEntryPage(env.APP_NAME, context, accounts, funds, {
      journal: "The transaction could not be posted as a balanced journal entry."
    });
  }

  return redirect("/dashboard");
}

async function getStatementOfActivities(request: Request, env: Env): Promise<Response> {
  const context = await requireAuth(request, env);
  if (context instanceof Response) return context;

  const url = new URL(request.url);
  const filters = parseStatementOfActivitiesFilters(url, context.organization.id);
  const funds = await listFunds(env, context.organization.id);

  if ("errors" in filters) {
    return statementOfActivitiesPage(env.APP_NAME, context, funds, null, filters.errors);
  }

  const report = await statementOfActivities(env, filters);
  return statementOfActivitiesPage(env.APP_NAME, context, funds, report);
}

function getStyles(): Response {
  return new Response(styles, {
    headers: {
      "Content-Type": "text/css; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

async function hasOrganization(env: Env): Promise<boolean> {
  const result = await env.DB.prepare("SELECT id FROM organizations LIMIT 1").first<{ id: string }>();
  return Boolean(result);
}

async function payrollPageWithErrors(env: Env, context: Awaited<ReturnType<typeof requireAuth>>, errors: Record<string, string>): Promise<Response> {
  if (context instanceof Response) return context;

  const year = new Date().getFullYear();
  const [employees, accounts, entries, summary] = await Promise.all([
    listPayrollEmployees(env, context.organization.id),
    listAccounts(env, context.organization.id),
    listPayrollEntries(env, context.organization.id),
    payrollSummary(env, context.organization.id, year)
  ]);

  return payrollPage(env.APP_NAME, context, employees, accounts, entries, summary, errors);
}

function shouldUseSecureCookie(request: Request): boolean {
  return new URL(request.url).protocol === "https:";
}

function validateReportDates(startDate: string, endDate: string): Record<string, string> | null {
  const errors: Record<string, string> = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) errors.startDate = "Start date is required.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) errors.endDate = "End date is required.";
  if (!errors.startDate && !errors.endDate && startDate > endDate) {
    errors.endDate = "End date must be after start date.";
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Content-Type-Options": "nosniff"
    }
  });
}
