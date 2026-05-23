import type { ChartAccount } from "./accounts.ts";
import type { JournalEntrySummary } from "./journalEntries.ts";
import type { PayrollEmployee, PayrollEntrySummary, PayrollSummary } from "./payroll.ts";
import type { Fund, StatementOfActivitiesReport, StatementOfActivitiesRow } from "./reports.ts";
import type { AccountType, AuthContext } from "./types.ts";

export function layout(options: {
  title: string;
  appName: string;
  body: string;
  context?: AuthContext;
}): Response {
  const navigation = options.context
    ? `<nav class="nav">
        <a href="/dashboard">Dashboard</a>
        <a href="/transactions/new">New transaction</a>
        <a href="/journal-entries/new">Journal entries</a>
        <a href="/payroll">Payroll</a>
        <a href="/funds">Funds</a>
        <a href="/accounts">Chart of accounts</a>
        <a href="/reports/statement-of-activities">Reports</a>
        <a href="/settings">Settings</a>
        <form method="post" action="/logout">
          <input type="hidden" name="csrfToken" value="${escapeHtml(options.context.csrfToken)}">
          <button class="link-button" type="submit">Sign out</button>
        </form>
      </nav>`
    : "";

  return html(`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${escapeHtml(options.title)} | ${escapeHtml(options.appName)}</title>
        <link rel="stylesheet" href="/assets/styles.css">
      </head>
      <body>
        <header class="topbar">
          <a class="brand" href="${options.context ? "/dashboard" : "/login"}">${escapeHtml(options.appName)}</a>
          ${navigation}
        </header>
        <main class="shell">${options.body}</main>
      </body>
    </html>`);
}

export function loginPage(appName: string, error?: string): Response {
  return layout({
    title: "Login",
    appName,
    body: `<section class="auth-panel">
      <div>
        <p class="eyebrow">Nonprofit accounting</p>
        <h1>Sign in to your workspace</h1>
        <p class="muted">Track funds, grants, and program spending with a small-team ledger built for nonprofit controls.</p>
      </div>
      <form method="post" action="/login" class="form-card">
        ${error ? `<p class="alert">${escapeHtml(error)}</p>` : ""}
        <label>Email<input name="email" type="email" autocomplete="email" required></label>
        <label>Password<input name="password" type="password" autocomplete="current-password" minlength="8" required></label>
        <button type="submit">Sign in</button>
        <a href="/setup">Set up the first organization</a>
      </form>
    </section>`
  });
}

export function setupPage(appName: string, errors: Record<string, string> = {}): Response {
  return layout({
    title: "Organization setup",
    appName,
    body: `<section class="page-heading">
        <p class="eyebrow">First run</p>
        <h1>Set up your organization</h1>
        <p class="muted">Create the first owner account and accounting workspace.</p>
      </section>
      <form method="post" action="/setup" class="grid-form">
        ${field("Organization name", "organizationName", "text", errors.organizationName, "Community Arts Fund")}
        <label>Fiscal year starts
          <select name="fiscalYearStartMonth">
            ${monthOptions()}
          </select>
          ${errorText(errors.fiscalYearStartMonth)}
        </label>
        ${field("Your name", "name", "text", errors.name, "Avery Chen")}
        ${field("Email", "email", "email", errors.email, "avery@example.org")}
        ${field("Owner password", "password", "password", errors.password)}
        <div class="form-actions">
          <a href="/login">Back to login</a>
          <button type="submit">Create organization</button>
        </div>
      </form>`
  });
}

export function dashboardPage(appName: string, context: AuthContext, stats: {
  accountCount: number;
  activeAccountCount: number;
}): Response {
  return layout({
    title: "Dashboard",
    appName,
    context,
    body: `<section class="page-heading dashboard-heading">
        ${context.organization.logo_data_url ? `<img class="org-logo" src="${escapeHtml(context.organization.logo_data_url)}" alt="${escapeHtml(context.organization.name)} logo">` : ""}
        <p class="eyebrow">${escapeHtml(context.organization.name)}</p>
        <h1>Accounting dashboard</h1>
        <p class="muted">Welcome back, ${escapeHtml(context.user.name)}. Your role is ${escapeHtml(context.role)}.</p>
      </section>
      <section class="metric-grid">
        <article class="metric"><span>Total accounts</span><strong>${stats.accountCount}</strong></article>
        <article class="metric"><span>Active accounts</span><strong>${stats.activeAccountCount}</strong></article>
        <article class="metric"><span>Currency</span><strong>${escapeHtml(context.organization.base_currency)}</strong></article>
      </section>
      <section class="content-band">
        <h2>Foundation modules</h2>
        <div class="task-list">
          <a href="/funds">Funds and restrictions</a>
          <a href="/journal-entries/new">Journal entries</a>
          <a href="/transactions/new">Income and expenses</a>
          <a href="/payroll">Payroll</a>
          <a href="/reports/statement-of-activities">Financial reports</a>
        </div>
      </section>`
  });
}

export function payrollPage(
  appName: string,
  context: AuthContext,
  employees: PayrollEmployee[],
  accounts: ChartAccount[],
  entries: PayrollEntrySummary[],
  summary: PayrollSummary,
  errors: Record<string, string> = {}
): Response {
  const cashAccounts = accounts.filter((account) => account.status === "active" && ["asset", "liability"].includes(account.account_type));
  const expenseAccounts = accounts.filter((account) => account.status === "active" && account.account_type === "expense");
  const liabilityAccounts = accounts.filter((account) => account.status === "active" && account.account_type === "liability");
  const employeeRows = employees.length
    ? employees
        .map(
          (employee) => `<tr>
            <td>${escapeHtml(employee.employee_code)}</td>
            <td>${escapeHtml(employee.employee_name)}</td>
            <td class="amount">${formatMoney(employee.hourly_rate_cents)}</td>
            <td class="amount">${formatMoney(employee.default_403b_cents)}</td>
            <td>${formatFilingStatus(employee.filing_status)}</td>
            <td>${formatStatus(employee.status)}</td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="6" class="empty">No payroll employees yet.</td></tr>`;
  const payrollRows = entries.length
    ? entries
        .map(
          (entry) => `<tr>
            <td>${escapeHtml(entry.record_number)}</td>
            <td>${escapeHtml(entry.pay_date)}</td>
            <td>${escapeHtml(entry.employee_name)}</td>
            <td class="amount">${formatMoney(entry.gross_pay_cents)}</td>
            <td class="amount">${formatMoney(entry.net_pay_cents)}</td>
            <td class="amount">${formatMoney(entry.employer_cost_cents)}</td>
            <td><a class="button-like small-button" href="/payroll/paystatement?id=${encodeURIComponent(entry.id)}">Pay statement</a></td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="7" class="empty">No payroll entries yet.</td></tr>`;

  return layout({
    title: "Payroll",
    appName,
    context,
    body: `<section class="page-heading">
        <p class="eyebrow">${escapeHtml(context.organization.name)}</p>
        <h1>Payroll</h1>
        <p class="muted">Calculate gross pay, W-4 federal withholding, Ohio/local tax, 403(b), FICA, net pay, and employer cost.</p>
      </section>
      ${errors.payroll ? `<p class="alert">${escapeHtml(errors.payroll)}</p>` : ""}
      <section class="metric-grid">
        <article class="metric"><span>${summary.year} gross payroll</span><strong>${formatMoney(summary.grossPayCents)}</strong></article>
        <article class="metric"><span>${summary.year} net payroll</span><strong>${formatMoney(summary.netPayCents)}</strong></article>
        <article class="metric"><span>Employer cost</span><strong>${formatMoney(summary.employerCostCents)}</strong></article>
      </section>
      <section class="split">
        <form method="post" action="/payroll/employees" class="form-card">
          <input type="hidden" name="csrfToken" value="${escapeHtml(context.csrfToken)}">
          <h2>Add employee</h2>
          ${field("Employee ID", "employeeCode", "text", errors.employeeCode, "EMP001")}
          ${field("Employee name", "employeeName", "text", errors.employeeName, "Stephen Kirk")}
          <label>Hourly rate
            <input name="hourlyRate" type="number" min="0.01" step="0.01" placeholder="25.00" required>
            ${errorText(errors.hourlyRate)}
          </label>
          <label>Default 403(b)
            <input name="default403b" type="number" min="0" step="0.01" placeholder="0.00">
            ${errorText(errors.default403b)}
          </label>
          <label>Filing status
            <select name="filingStatus">
              <option value="single">Single or married filing separately</option>
              <option value="married">Married filing jointly</option>
              <option value="head_of_household">Head of household</option>
            </select>
            ${errorText(errors.filingStatus)}
          </label>
          <label>Status
            <select name="status">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            ${errorText(errors.status)}
          </label>
          <label class="check-row"><input name="step2Checked" type="checkbox"> W-4 step 2 checked</label>
          <label class="check-row"><input name="federalExempt" type="checkbox"> Federal exempt</label>
          <label>W-4 step 3 credits
            <input name="step3Credits" type="number" min="0" step="0.01" placeholder="0.00">
          </label>
          <label>W-4 step 4(a) other income
            <input name="step4aOtherIncome" type="number" min="0" step="0.01" placeholder="0.00">
          </label>
          <label>W-4 step 4(b) deductions
            <input name="step4bDeductions" type="number" min="0" step="0.01" placeholder="0.00">
          </label>
          <label>W-4 step 4(c) extra withholding
            <input name="step4cExtraWithholding" type="number" min="0" step="0.01" placeholder="0.00">
          </label>
          <button type="submit">Add employee</button>
        </form>
        <form method="post" action="/payroll/entries" class="form-card">
          <input type="hidden" name="csrfToken" value="${escapeHtml(context.csrfToken)}">
          <h2>Enter payroll</h2>
          <label>Employee
            <select name="employeeId">
              ${payrollEmployeeOptions(employees)}
            </select>
            ${errorText(errors.employeeId)}
          </label>
          ${field("Pay date", "payDate", "date", errors.payDate)}
          ${field("Period start", "periodStart", "date", errors.periodStart)}
          ${field("Period end", "periodEnd", "date", errors.periodEnd)}
          <label>Pay frequency
            <select name="payFrequency">
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
              <option value="semimonthly">Semimonthly</option>
              <option value="monthly">Monthly</option>
            </select>
            ${errorText(errors.payFrequency)}
          </label>
          <label>Hours worked
            <input name="hoursWorked" type="number" min="0" step="0.01" placeholder="80.00" required>
            ${errorText(errors.hoursWorked)}
          </label>
          <label>Bonus / other taxable
            <input name="bonusTaxable" type="number" min="0" step="0.01" placeholder="0.00">
            ${errorText(errors.bonusTaxable)}
          </label>
          <label>403(b) override
            <input name="override403b" type="number" min="0" step="0.01" placeholder="Leave blank for employee default">
            ${errorText(errors.override403b)}
          </label>
          <label>Bank or cash account
            <select name="cashAccountId">
              ${accountOptions(cashAccounts, "No active asset or liability accounts")}
            </select>
            ${errorText(errors.cashAccountId)}
          </label>
          <label>Wage expense account
            <select name="wageExpenseAccountId">
              ${accountOptions(expenseAccounts, "No active expense accounts")}
            </select>
            ${errorText(errors.wageExpenseAccountId)}
          </label>
          <label>Payroll tax expense account
            <select name="payrollTaxExpenseAccountId">
              ${accountOptions(expenseAccounts, "No active expense accounts")}
            </select>
            ${errorText(errors.payrollTaxExpenseAccountId)}
          </label>
          <label>Payroll tax liability account
            <select name="withholdingLiabilityAccountId">
              ${accountOptions(liabilityAccounts, "No active liability accounts")}
            </select>
            ${errorText(errors.withholdingLiabilityAccountId)}
          </label>
          <label>403(b) liability account
            <select name="retirementLiabilityAccountId">
              ${accountOptions(liabilityAccounts, "No active liability accounts")}
            </select>
            ${errorText(errors.retirementLiabilityAccountId)}
          </label>
          <button type="submit">Calculate payroll</button>
        </form>
      </section>
      <section class="content-band report-section">
        <h2>Payroll tax report</h2>
        <form method="get" action="/payroll/reports/employer-taxes.pdf" class="grid-form report-filter">
          <label>Start date
            <input name="startDate" type="date" required>
            ${errorText(errors.startDate)}
          </label>
          <label>End date
            <input name="endDate" type="date" required>
            ${errorText(errors.endDate)}
          </label>
          <div class="form-actions">
            <button type="submit">Download tax report PDF</button>
          </div>
        </form>
        <div class="export-actions">
          <a class="button-like small-button" href="/payroll/export/employees.csv">Export employees CSV</a>
          <a class="button-like small-button" href="/payroll/export/payroll.csv">Export payroll CSV</a>
          <a class="button-like small-button" href="/payroll/import/template.csv">Download import template</a>
        </div>
        <form method="post" action="/payroll/import/payroll.csv" enctype="multipart/form-data" class="grid-form report-filter">
          <input type="hidden" name="csrfToken" value="${escapeHtml(context.csrfToken)}">
          <label>Payroll CSV
            <input name="payrollCsv" type="file" accept=".csv,text/csv" required>
          </label>
          <label>Bank or cash account
            <select name="cashAccountId">
              ${accountOptions(cashAccounts, "No active asset or liability accounts")}
            </select>
            ${errorText(errors.cashAccountId)}
          </label>
          <label>Wage expense account
            <select name="wageExpenseAccountId">
              ${accountOptions(expenseAccounts, "No active expense accounts")}
            </select>
            ${errorText(errors.wageExpenseAccountId)}
          </label>
          <label>Payroll tax expense account
            <select name="payrollTaxExpenseAccountId">
              ${accountOptions(expenseAccounts, "No active expense accounts")}
            </select>
            ${errorText(errors.payrollTaxExpenseAccountId)}
          </label>
          <label>Payroll tax liability account
            <select name="withholdingLiabilityAccountId">
              ${accountOptions(liabilityAccounts, "No active liability accounts")}
            </select>
            ${errorText(errors.withholdingLiabilityAccountId)}
          </label>
          <label>403(b) liability account
            <select name="retirementLiabilityAccountId">
              ${accountOptions(liabilityAccounts, "No active liability accounts")}
            </select>
            ${errorText(errors.retirementLiabilityAccountId)}
          </label>
          <div class="form-actions">
            <button type="submit">Upload payroll CSV</button>
          </div>
        </form>
        <h2>Employees</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>ID</th><th>Name</th><th>Hourly</th><th>403(b)</th><th>Filing</th><th>Status</th></tr></thead>
            <tbody>${employeeRows}</tbody>
          </table>
        </div>
        ${employeeEditCards(employees, context.csrfToken)}
        <h2>Recent payroll</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Record</th><th>Pay date</th><th>Employee</th><th>Gross</th><th>Net</th><th>Employer cost</th><th>PDF</th></tr></thead>
            <tbody>${payrollRows}</tbody>
          </table>
        </div>
      </section>`
  });
}

export function settingsPage(
  appName: string,
  context: AuthContext,
  errors: Record<string, string> = {}
): Response {
  return layout({
    title: "Settings",
    appName,
    context,
    body: `<section class="page-heading">
        <p class="eyebrow">${escapeHtml(context.organization.name)}</p>
        <h1>Settings</h1>
        <p class="muted">Manage your profile, password, and organization logo.</p>
      </section>
      <section class="settings-grid">
        <form method="post" action="/settings/profile" class="form-card">
          <input type="hidden" name="csrfToken" value="${escapeHtml(context.csrfToken)}">
          <h2>Profile</h2>
          <label>Name
            <input name="name" type="text" value="${escapeHtml(context.user.name)}" required>
            ${errorText(errors.name)}
          </label>
          <button type="submit">Save name</button>
        </form>
        <form method="post" action="/settings/password" class="form-card">
          <input type="hidden" name="csrfToken" value="${escapeHtml(context.csrfToken)}">
          <h2>Password</h2>
          <label>Current password
            <input name="currentPassword" type="password" autocomplete="current-password" required>
            ${errorText(errors.currentPassword)}
          </label>
          <label>New password
            <input name="newPassword" type="password" autocomplete="new-password" minlength="12" required>
            ${errorText(errors.newPassword)}
          </label>
          <label>Confirm password
            <input name="confirmPassword" type="password" autocomplete="new-password" minlength="12" required>
            ${errorText(errors.confirmPassword)}
          </label>
          <button type="submit">Change password</button>
        </form>
        <form method="post" action="/settings/logo" enctype="multipart/form-data" class="form-card">
          <input type="hidden" name="csrfToken" value="${escapeHtml(context.csrfToken)}">
          <h2>Organization logo</h2>
          ${context.organization.logo_data_url ? `<img class="logo-preview" src="${escapeHtml(context.organization.logo_data_url)}" alt="${escapeHtml(context.organization.name)} logo">` : ""}
          <label>Logo image
            <input name="logo" type="file" accept="image/png,image/jpeg,image/webp,image/gif" required>
            ${errorText(errors.logo)}
          </label>
          <button type="submit">Upload logo</button>
        </form>
      </section>`
  });
}

export function fundsPage(
  appName: string,
  context: AuthContext,
  funds: Fund[],
  errors: Record<string, string> = {}
): Response {
  const rows = funds.length
    ? funds
        .map(
          (fund) => `<tr>
            <td>${escapeHtml(fund.name)}</td>
            <td>${formatStatus(fund.status)}</td>
            <td>${escapeHtml(fund.organization_id)}</td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="3" class="empty">No funds yet.</td></tr>`;

  return layout({
    title: "Funds",
    appName,
    context,
    body: `<section class="page-heading">
        <p class="eyebrow">${escapeHtml(context.organization.name)}</p>
        <h1>Funds</h1>
        <p class="muted">Track restricted and unrestricted activity by assigning transactions and journal lines to funds.</p>
      </section>
      <section class="split">
        <form method="post" action="/funds" class="form-card">
          <input type="hidden" name="csrfToken" value="${escapeHtml(context.csrfToken)}">
          <h2>Add fund</h2>
          ${field("Fund name", "name", "text", errors.name, "Building Fund")}
          <button type="submit">Add fund</button>
        </form>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Status</th><th>Organization ID</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>`
  });
}

export function accountsPage(
  appName: string,
  context: AuthContext,
  accounts: ChartAccount[],
  errors: Record<string, string> = {}
): Response {
  const rows = accounts.length
    ? accounts
        .map(
          (account) => `<tr>
            <td>${escapeHtml(account.organization_id)}</td>
            <td>${escapeHtml(account.account_number)}</td>
            <td>${escapeHtml(account.account_name)}</td>
            <td>${formatAccountType(account.account_type)}</td>
            <td>${escapeHtml(account.normal_balance)}</td>
            <td>${formatStatus(account.status)}</td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="6" class="empty">No accounts yet.</td></tr>`;

  return layout({
    title: "Chart of accounts",
    appName,
    context,
    body: `<section class="page-heading">
        <p class="eyebrow">${escapeHtml(context.organization.name)}</p>
        <h1>Chart of accounts</h1>
        <p class="muted">Create the initial account list used for nonprofit transactions and reports.</p>
      </section>
      <section class="split">
        <form method="post" action="/accounts" class="form-card">
          <input type="hidden" name="csrfToken" value="${escapeHtml(context.csrfToken)}">
          <h2>Add account</h2>
          ${field("Account number", "accountNumber", "text", errors.accountNumber, "4000")}
          ${field("Account name", "accountName", "text", errors.accountName, "Individual Contributions")}
          <label>Type
            <select name="accountType">
              <option value="asset">Asset</option>
              <option value="liability">Liability</option>
              <option value="net_asset">Net asset</option>
              <option value="revenue">Revenue</option>
              <option value="expense">Expense</option>
            </select>
            ${errorText(errors.accountType)}
          </label>
          <label>Normal balance
            <select name="normalBalance">
              <option value="debit">Debit</option>
              <option value="credit">Credit</option>
            </select>
            ${errorText(errors.normalBalance)}
          </label>
          <label>Status
            <select name="status">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            ${errorText(errors.status)}
          </label>
          <button type="submit">Add account</button>
        </form>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Organization ID</th><th>Number</th><th>Name</th><th>Type</th><th>Normal</th><th>Status</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>`
  });
}

export function transactionEntryPage(
  appName: string,
  context: AuthContext,
  accounts: ChartAccount[],
  funds: Fund[],
  errors: Record<string, string> = {}
): Response {
  const cashAccounts = accounts.filter(
    (account) => account.status === "active" && ["asset", "liability"].includes(account.account_type)
  );
  const categoryAccounts = accounts.filter(
    (account) => account.status === "active" && ["revenue", "expense"].includes(account.account_type)
  );

  return layout({
    title: "New transaction",
    appName,
    context,
    body: `<section class="page-heading">
        <p class="eyebrow">${escapeHtml(context.organization.name)}</p>
        <h1>Enter income or expense</h1>
        <p class="muted">Simple entries are posted as balanced journal entries behind the scenes.</p>
      </section>
      <form method="post" action="/transactions" class="grid-form">
        <input type="hidden" name="csrfToken" value="${escapeHtml(context.csrfToken)}">
        <label>Type
          <select name="transactionType">
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
          ${errorText(errors.transactionType)}
        </label>
        ${field("Date", "transactionDate", "date", errors.transactionDate)}
        ${field("Description", "description", "text", errors.description, "Sunday offering")}
        <label>Amount
          <input name="amount" type="number" min="0.01" step="0.01" placeholder="125.00" required>
          ${errorText(errors.amount)}
        </label>
        <label>Cash or bank account
          <select name="cashAccountId">
            ${accountOptions(cashAccounts, "No active asset or liability accounts")}
          </select>
          ${errorText(errors.cashAccountId)}
        </label>
        <label>Income or expense account
          <select name="categoryAccountId">
            ${accountOptions(categoryAccounts, "No active income or expense accounts")}
          </select>
          ${errorText(errors.categoryAccountId)}
        </label>
        <label>Fund
          <select name="fundId">
            <option value="">No fund</option>
            ${fundOptions(funds)}
          </select>
        </label>
        ${errors.journal ? `<p class="alert">${escapeHtml(errors.journal)}</p>` : ""}
        <div class="form-actions">
          <a href="/dashboard">Cancel</a>
          <button type="submit">Post transaction</button>
        </div>
      </form>`
  });
}

export function journalEntryPage(
  appName: string,
  context: AuthContext,
  accounts: ChartAccount[],
  funds: Fund[],
  entries: JournalEntrySummary[],
  error = ""
): Response {
  const activeAccounts = accounts.filter((account) => account.status === "active");
  const entryRows = entries.length
    ? entries
        .map(
          (entry) => `<tr>
            <td>${escapeHtml(entry.entry_number)}</td>
            <td>${escapeHtml(entry.entry_date)}</td>
            <td>${escapeHtml(entry.description)}</td>
            <td>${formatStatus(entry.status)}</td>
            <td class="amount">${formatMoney(entry.total_debit_cents)}</td>
            <td class="amount">${formatMoney(entry.total_credit_cents)}</td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="6" class="empty">No journal entries yet.</td></tr>`;

  return layout({
    title: "Journal entries",
    appName,
    context,
    body: `<section class="page-heading">
        <p class="eyebrow">${escapeHtml(context.organization.name)}</p>
        <h1>Journal entries</h1>
        <p class="muted">Create manual balanced entries. Total debits must equal total credits before posting.</p>
      </section>
      <form method="post" action="/journal-entries" class="grid-form">
        <input type="hidden" name="csrfToken" value="${escapeHtml(context.csrfToken)}">
        ${error ? `<p class="alert">${escapeHtml(error)}</p>` : ""}
        ${field("Date", "entryDate", "date", undefined)}
        ${field("Description", "description", "text", undefined, "Payroll accrual")}
        ${journalLineFields(1, activeAccounts, funds)}
        ${journalLineFields(2, activeAccounts, funds)}
        <div class="form-actions">
          <button type="submit">Post journal entry</button>
        </div>
      </form>
      <section class="content-band report-section">
        <h2>Recent journal entries</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Entry</th><th>Date</th><th>Description</th><th>Status</th><th>Debits</th><th>Credits</th></tr></thead>
            <tbody>${entryRows}</tbody>
          </table>
        </div>
      </section>`
  });
}

export function statementOfActivitiesPage(
  appName: string,
  context: AuthContext,
  funds: Fund[],
  report: StatementOfActivitiesReport | null,
  errors: Record<string, string> = {}
): Response {
  return layout({
    title: "Statement of Activities",
    appName,
    context,
    body: `<section class="page-heading">
        <p class="eyebrow">${escapeHtml(context.organization.name)}</p>
        <h1>Statement of Activities</h1>
        <p class="muted">Posted revenue and expense activity from journal entry lines.</p>
      </section>
      <form method="get" action="/reports/statement-of-activities" class="grid-form report-filter">
        ${dateFilterField("Start date", "startDate", errors.startDate, report?.filters.startDate)}
        ${dateFilterField("End date", "endDate", errors.endDate, report?.filters.endDate)}
        <label>Fund
          <select name="fundId">
            <option value="">All funds</option>
            ${fundOptions(funds, report?.filters.fundId)}
          </select>
        </label>
        <div class="form-actions">
          <button type="submit">Run report</button>
        </div>
      </form>
      ${
        report
          ? `<section class="content-band report-section">
              <h2>Revenue</h2>
              ${statementRowsTable(report.revenues)}
              ${reportTotal("Total revenue", report.totalRevenueCents)}
              <h2>Expenses</h2>
              ${statementRowsTable(report.expenses)}
              ${reportTotal("Total expenses", report.totalExpenseCents)}
              <div class="report-net">
                <span>Change in net assets</span>
                <strong>${formatMoney(report.changeInNetAssetsCents)}</strong>
              </div>
            </section>`
          : ""
      }`
  });
}

export function organizationAlreadyConfiguredPage(appName: string): Response {
  return layout({
    title: "Setup unavailable",
    appName,
    body: `<section class="auth-panel">
      <div>
        <p class="eyebrow">Setup complete</p>
        <h1>An organization already exists</h1>
        <p class="muted">Use the existing owner account to sign in.</p>
      </div>
      <a class="button-like" href="/login">Go to login</a>
    </section>`
  });
}

export function html(body: string, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "same-origin");
  headers.set("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; style-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");

  return new Response(body, {
    ...init,
    headers
  });
}

function field(labelText: string, name: string, type: string, error?: string, placeholder = ""): string {
  return `<label>${escapeHtml(labelText)}
    <input name="${escapeHtml(name)}" type="${escapeHtml(type)}" placeholder="${escapeHtml(placeholder)}" ${type === "password" ? "autocomplete=\"new-password\"" : ""} required>
    ${errorText(error)}
  </label>`;
}

function dateFilterField(labelText: string, name: string, error?: string, value = ""): string {
  return `<label>${escapeHtml(labelText)}
    <input name="${escapeHtml(name)}" type="date" value="${escapeHtml(value)}">
    ${errorText(error)}
  </label>`;
}

function errorText(error?: string): string {
  return error ? `<span class="field-error">${escapeHtml(error)}</span>` : "";
}

function monthOptions(): string {
  return [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December"
  ]
    .map((month, index) => `<option value="${index + 1}">${month}</option>`)
    .join("");
}

function accountOptions(accounts: ChartAccount[], emptyText: string): string {
  if (accounts.length === 0) {
    return `<option value="">${escapeHtml(emptyText)}</option>`;
  }

  return accounts
    .map(
      (account) =>
        `<option value="${escapeHtml(account.id)}">${escapeHtml(account.account_number)} - ${escapeHtml(account.account_name)}</option>`
    )
    .join("");
}

function journalLineFields(lineNumber: number, accounts: ChartAccount[], funds: Fund[]): string {
  return `<fieldset class="line-set">
    <legend>Line ${lineNumber}</legend>
    <label>Account
      <select name="line${lineNumber}AccountId">
        ${accountOptions(accounts, "No active accounts")}
      </select>
    </label>
    <label>Fund
      <select name="line${lineNumber}FundId">
        <option value="">No fund</option>
        ${fundOptions(funds)}
      </select>
    </label>
    ${field("Description", `line${lineNumber}Description`, "text", undefined, `Line ${lineNumber}`)}
    <label>Debit
      <input name="line${lineNumber}Debit" type="number" min="0" step="0.01" placeholder="0.00">
    </label>
    <label>Credit
      <input name="line${lineNumber}Credit" type="number" min="0" step="0.01" placeholder="0.00">
    </label>
  </fieldset>`;
}

function fundOptions(funds: Fund[], selectedFundId = ""): string {
  return funds
    .filter((fund) => fund.status === "active")
    .map((fund) => {
      const selected = fund.id === selectedFundId ? " selected" : "";
      return `<option value="${escapeHtml(fund.id)}"${selected}>${escapeHtml(fund.name)}</option>`;
    })
    .join("");
}

function payrollEmployeeOptions(employees: PayrollEmployee[]): string {
  const activeEmployees = employees.filter((employee) => employee.status === "active");
  if (activeEmployees.length === 0) {
    return `<option value="">No active payroll employees</option>`;
  }

  return activeEmployees
    .map(
      (employee) =>
        `<option value="${escapeHtml(employee.id)}">${escapeHtml(employee.employee_code)} - ${escapeHtml(employee.employee_name)}</option>`
    )
    .join("");
}

function employeeEditCards(employees: PayrollEmployee[], csrfToken: string): string {
  if (employees.length === 0) return "";

  return `<details class="employee-editor">
    <summary>Edit or remove employee records</summary>
    <div class="employee-edit-grid">
      ${employees
        .map(
          (employee) => `<form method="post" action="/payroll/employees/update" class="employee-edit-card">
            <input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}">
            <input type="hidden" name="employeeId" value="${escapeHtml(employee.id)}">
            <h3>${escapeHtml(employee.employee_name)}</h3>
            <label>Employee ID
              <input name="employeeCode" type="text" value="${escapeHtml(employee.employee_code)}" required>
            </label>
            <label>Employee name
              <input name="employeeName" type="text" value="${escapeHtml(employee.employee_name)}" required>
            </label>
            <label>Hourly rate
              <input name="hourlyRate" type="number" min="0.01" step="0.01" value="${centsInputValue(employee.hourly_rate_cents)}" required>
            </label>
            <label>Default 403(b)
              <input name="default403b" type="number" min="0" step="0.01" value="${centsInputValue(employee.default_403b_cents)}">
            </label>
            <label>Filing status
              <select name="filingStatus">
                <option value="single"${selected(employee.filing_status, "single")}>Single or married filing separately</option>
                <option value="married"${selected(employee.filing_status, "married")}>Married filing jointly</option>
                <option value="head_of_household"${selected(employee.filing_status, "head_of_household")}>Head of household</option>
              </select>
            </label>
            <label>Status
              <select name="status">
                <option value="active"${selected(employee.status, "active")}>Active</option>
                <option value="inactive"${selected(employee.status, "inactive")}>Inactive</option>
              </select>
            </label>
            <label class="check-row"><input name="step2Checked" type="checkbox"${checked(employee.step2_checked)}> W-4 step 2 checked</label>
            <label class="check-row"><input name="federalExempt" type="checkbox"${checked(employee.federal_exempt)}> Federal exempt</label>
            <label>W-4 step 3 credits
              <input name="step3Credits" type="number" min="0" step="0.01" value="${centsInputValue(employee.step3_credits_cents)}">
            </label>
            <label>W-4 step 4(a) other income
              <input name="step4aOtherIncome" type="number" min="0" step="0.01" value="${centsInputValue(employee.step4a_other_income_cents)}">
            </label>
            <label>W-4 step 4(b) deductions
              <input name="step4bDeductions" type="number" min="0" step="0.01" value="${centsInputValue(employee.step4b_deductions_cents)}">
            </label>
            <label>W-4 step 4(c) extra withholding
              <input name="step4cExtraWithholding" type="number" min="0" step="0.01" value="${centsInputValue(employee.step4c_extra_withholding_cents)}">
            </label>
            <div class="employee-edit-actions">
              <button type="submit">Save</button>
              <button class="danger-button" type="submit" formaction="/payroll/employees/delete">Delete</button>
            </div>
          </form>`
        )
        .join("")}
    </div>
  </details>`;
}

function statementRowsTable(rows: StatementOfActivitiesRow[]): string {
  const body = rows.length
    ? rows
        .map(
          (row) => `<tr>
            <td>${escapeHtml(row.account_number)}</td>
            <td>${escapeHtml(row.account_name)}</td>
            <td class="amount">${formatMoney(row.amount_cents)}</td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="3" class="empty">No activity.</td></tr>`;

  return `<div class="table-wrap report-table">
    <table>
      <thead><tr><th>Account</th><th>Name</th><th>Amount</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
  </div>`;
}

function reportTotal(label: string, amountCents: number): string {
  return `<div class="report-total"><span>${escapeHtml(label)}</span><strong>${formatMoney(amountCents)}</strong></div>`;
}

function formatMoney(amountCents: number): string {
  const sign = amountCents < 0 ? "-" : "";
  const absolute = Math.abs(amountCents);
  return `${sign}$${(absolute / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function formatAccountType(type: AccountType): string {
  return type
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function formatFilingStatus(status: string): string {
  if (status === "married") return "Married filing jointly";
  if (status === "head_of_household") return "Head of household";
  return "Single";
}

function formatStatus(status: string): string {
  return status[0].toUpperCase() + status.slice(1);
}

function centsInputValue(amountCents: number): string {
  return (amountCents / 100).toFixed(2);
}

function selected(current: string, value: string): string {
  return current === value ? " selected" : "";
}

function checked(value: number): string {
  return value === 1 ? " checked" : "";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
