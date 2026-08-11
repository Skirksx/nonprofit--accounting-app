import type { ChartAccount } from "./accounts.ts";
import type { OrganizationUser, UserOrganization } from "./auth.ts";
import type { JournalEntryDetail, JournalEntryLineRecord, JournalEntrySummary } from "./journalEntries.ts";
import {
  frequencyLabel,
  invoiceIncludedLabel,
  memberDuesInvoice,
  memberInvoiceEmailHref,
  type MemberDuesRecord,
  type MemberDuesSettings
} from "./memberDues.ts";
import type { PayrollEmployee, PayrollEntrySummary, PayrollSummary } from "./payroll.ts";
import type {
  AccountRegisterReport,
  BalanceSheetReport,
  BudgetLineRecord,
  BudgetVsActualReport,
  BudgetVsActualRow,
  FinancialReportRow,
  Fund,
  FundActivityReport,
  IncomeStatementReport,
  StatementOfActivitiesDetailRow,
  StatementOfActivitiesReport,
  StatementOfActivitiesRow
} from "./reports.ts";
import { rotaryLogoDataUrl } from "./reports.ts";
import type { AccountType, AuthContext } from "./types.ts";

export function layout(options: {
  title: string;
  appName: string;
  body: string;
  context?: AuthContext;
}): Response {
  const logoSrc = options.context ? organizationLogoSrc(options.context) : null;
  const brandLogo = logoSrc
    ? `<img class="brand-logo" src="${escapeHtml(logoSrc)}" alt="${escapeHtml(options.context?.organization.name ?? options.appName)} logo">`
    : "";
  const organizationBadge = options.context
    ? `<span class="brand-org">${escapeHtml(options.context.organization.name)}</span>`
    : "";
  const payrollLink = options.context?.organization.organization_profile === "church"
    ? `<a href="/payroll">Payroll</a>`
    : "";
  const memberDuesLink = options.context?.organization.organization_profile === "rotary"
    ? `<a href="/member-dues">Member Dues Tracking</a>`
    : "";
  const navigation = options.context
    ? `<nav class="nav">
        <a href="/dashboard">Dashboard</a>
        <a href="/transactions/new">New transaction</a>
        <a href="/journal-entries/new">Advanced ledger</a>
        ${payrollLink}
        ${memberDuesLink}
        <a href="/funds">Funds</a>
        <a href="/accounts">Chart of accounts</a>
        <a href="/budget">Budget</a>
        <a href="/reports/statement-of-activities">Reports</a>
        <a href="/organizations">Organizations</a>
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
        <link rel="stylesheet" href="/assets/styles.css?v=member-dues-wide-2">
        <script src="/assets/app.js?v=member-dues-widths-4" defer></script>
      </head>
      <body>
        <header class="topbar">
          <a class="brand" href="${options.context ? "/dashboard" : "/login"}">
            ${brandLogo}
            <span>
              <strong>${escapeHtml(options.appName)}</strong>
              ${organizationBadge}
            </span>
          </a>
          ${navigation}
        </header>
        <main class="shell">${options.body}</main>
      </body>
    </html>`);
}

function organizationLogoSrc(context: AuthContext): string | null {
  return context.organization.logo_data_url
    ?? (context.organization.organization_profile === "rotary" ? rotaryLogoDataUrl() : null);
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
        <label>Organization type
          <select name="organizationProfile">
            <option value="church">Church</option>
            <option value="rotary">Rotary / service club</option>
          </select>
          ${errorText(errors.organizationProfile)}
        </label>
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
  const profile = organizationProfileContent(context);
  const logoSrc = organizationLogoSrc(context);
  return layout({
    title: "Dashboard",
    appName,
    context,
    body: `<section class="page-heading dashboard-heading branded-heading">
        ${logoSrc ? `<img class="org-logo" src="${escapeHtml(logoSrc)}" alt="${escapeHtml(context.organization.name)} logo">` : ""}
        <div>
          <p class="eyebrow">${escapeHtml(context.organization.name)}</p>
          <h1>${escapeHtml(profile.heading)}</h1>
          <p class="muted">${escapeHtml(profile.description)} Welcome back, ${escapeHtml(context.user.name)}. Your role is ${escapeHtml(context.role)}.</p>
        </div>
      </section>
      <section class="metric-grid">
        <article class="metric"><span>Total accounts</span><strong>${stats.accountCount}</strong></article>
        <article class="metric"><span>Active accounts</span><strong>${stats.activeAccountCount}</strong></article>
        <article class="metric"><span>Currency</span><strong>${escapeHtml(context.organization.base_currency)}</strong></article>
      </section>
      <section class="content-band">
        <h2>${escapeHtml(profile.moduleTitle)}</h2>
        <div class="task-list">
          ${profile.tasks.map((task) => `<a href="${escapeHtml(task.href)}">${escapeHtml(task.label)}</a>`).join("")}
          <a href="/transactions/new">Income and expenses</a>
          <a href="/journal-entries/new">Advanced ledger</a>
          <a href="/reports/statement-of-activities">Financial reports</a>
        </div>
      </section>`
  });
}

export function organizationsPage(
  appName: string,
  context: AuthContext,
  organizations: UserOrganization[],
  errors: Record<string, string> = {}
): Response {
  const rows = organizations.length
    ? organizations
        .map((organization) => {
          const isCurrent = organization.id === context.organization.id;
          return `<tr>
            <td>${escapeHtml(organization.name)}</td>
            <td>${formatOrganizationProfile(organization.organization_profile)}</td>
            <td>${formatStatus(organization.role)}</td>
            <td>${isCurrent ? "Current" : `<form method="post" action="/organizations/switch">
              <input type="hidden" name="csrfToken" value="${escapeHtml(context.csrfToken)}">
              <input type="hidden" name="organizationId" value="${escapeHtml(organization.id)}">
              <button class="small-button" type="submit">Open</button>
            </form>`}</td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="4" class="empty">No organizations found.</td></tr>`;

  return layout({
    title: "Organizations",
    appName,
    context,
    body: `<section class="page-heading">
        <p class="eyebrow">${escapeHtml(context.user.name)}</p>
        <h1>Organizations</h1>
        <p class="muted">Keep separate books for each organization while using the same sign-in.</p>
      </section>
      ${errors.organizationId ? `<p class="alert">${escapeHtml(errors.organizationId)}</p>` : ""}
      <section class="split">
        <section class="content-band">
          <h2>Your organizations</h2>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Type</th><th>Your role</th><th>Open</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </section>
        <form method="post" action="/organizations" class="form-card">
          <input type="hidden" name="csrfToken" value="${escapeHtml(context.csrfToken)}">
          <h2>Add organization</h2>
          ${field("Organization name", "organizationName", "text", errors.organizationName, "Rotary Club")}
          <label>Organization type
            <select name="organizationProfile">
              <option value="church">Church</option>
              <option value="rotary">Rotary / service club</option>
            </select>
            ${errorText(errors.organizationProfile)}
          </label>
          <label>Fiscal year starts
            <select name="fiscalYearStartMonth">
              ${monthOptions()}
            </select>
            ${errorText(errors.fiscalYearStartMonth)}
          </label>
          <button type="submit">Create and open</button>
        </form>
      </section>`
  });
}

export function memberDuesPage(appName: string, context: AuthContext, members: MemberDuesRecord[], settings: MemberDuesSettings): Response {
  const paidCount = members.reduce((sum, member) => sum + member.q1_paid + member.q2_paid + member.q3_paid + member.q4_paid, 0);
  const openCount = members.length * 4 - paidCount;
  return layout({
    title: "Member Dues Tracking",
    appName,
    context,
    body: `<section class="page-heading">
        <p class="eyebrow">${escapeHtml(context.organization.name)}</p>
        <h1>Member Dues Tracking</h1>
        <p class="muted">Track dues frequency, invoice type, quarterly payments, notes, and invoice actions for Rotary members.</p>
      </section>
      <section class="metric-grid">
        <article class="metric"><span>Members</span><strong>${members.length}</strong></article>
        <article class="metric"><span>Paid quarters</span><strong>${paidCount}</strong></article>
        <article class="metric"><span>Open quarters</span><strong>${openCount}</strong></article>
      </section>
      <section class="content-band dues-toolbar">
        <div>
          <h2>M&M Rotary Club - Fiscal Year ${escapeHtml(settings.fiscal_year)}</h2>
          <p class="muted">Click a member name to prepare an invoice PDF and email draft.</p>
        </div>
        <form method="post" action="/member-dues/settings" class="dues-settings-form">
          <input type="hidden" name="csrfToken" value="${escapeHtml(context.csrfToken)}">
          <label>Fiscal year
            <select name="fiscalYear">
              ${fiscalYearOptions(settings.fiscal_year)}
            </select>
          </label>
          <label>Quarterly dues
            <input name="quarterlyDues" inputmode="decimal" value="${centsInputValue(settings.quarterly_dues_cents)}">
          </label>
          <label>Meal amount
            <input name="mealAmount" inputmode="decimal" value="${centsInputValue(settings.meal_cents)}">
          </label>
          <label>Meeting day
            <select name="meetingDay">
              ${meetingDayOptions(settings.meeting_day)}
            </select>
          </label>
          <button type="submit">Save settings</button>
        </form>
      </section>
      <section class="content-band dues-column-panel">
        <details>
          <summary>Column widths</summary>
          <div class="dues-column-controls">
            ${memberDuesColumnControls()}
            <button class="small-button" type="button" data-dues-reset-widths>Reset widths</button>
          </div>
        </details>
      </section>
      <div class="table-wrap dues-sheet" data-dues-sheet data-width-storage-key="member-dues-widths-${escapeHtml(settings.fiscal_year)}">
        <table style="width: var(--dues-table-width, 2590px); min-width: var(--dues-table-width, 2590px);">
          <colgroup>
            <col class="dues-col-member" style="width: var(--dues-col-member-width, 250px);">
            <col class="dues-col-email" style="width: var(--dues-col-email-width, 520px);">
            <col class="dues-col-address" style="width: var(--dues-col-address-width, 380px);">
            <col class="dues-col-frequency" style="width: var(--dues-col-frequency-width, 210px);">
            <col class="dues-col-included" style="width: var(--dues-col-included-width, 220px);">
            <col class="dues-col-quarter" style="width: var(--dues-col-q1-width, 105px);">
            <col class="dues-col-quarter" style="width: var(--dues-col-q2-width, 105px);">
            <col class="dues-col-quarter" style="width: var(--dues-col-q3-width, 105px);">
            <col class="dues-col-quarter" style="width: var(--dues-col-q4-width, 105px);">
            <col class="dues-col-notes" style="width: var(--dues-col-notes-width, 560px);">
            <col class="dues-col-save" style="width: var(--dues-col-save-width, 130px);">
          </colgroup>
          <thead>
            <tr>
              <th>Member Name</th>
              <th>Email</th>
              <th>Address</th>
              <th>Dues Frequency Preference</th>
              <th>Included on invoice</th>
              <th>Q1<br>(7/1-9/30)<br>Paid</th>
              <th>Q2<br>(10/1-12/31)<br>Paid</th>
              <th>Q3<br>(1/1-3/31)<br>Paid</th>
              <th>Q4<br>(4/1-6/30)<br>Paid</th>
              <th>Notes</th>
              <th>Save</th>
            </tr>
          </thead>
          <tbody>
            ${members.map((member) => memberDuesRow(member, context.csrfToken)).join("")}
          </tbody>
        </table>
      </div>`
  });
}

export function memberDuesDetailPage(appName: string, context: AuthContext, member: MemberDuesRecord, settings: MemberDuesSettings): Response {
  const invoice = memberDuesInvoice(member, settings);
  return layout({
    title: "Member dues invoice",
    appName,
    context,
    body: `<section class="page-heading">
        <p class="eyebrow">Member dues tracking</p>
        <h1>${escapeHtml(member.member_name.split("\n")[0])}</h1>
        <p class="muted">Create an invoice PDF or open an email draft for this member. Automatic sending can be added once an email service is connected.</p>
      </section>
      <section class="split">
        <div class="content-band">
          <h2>Member details</h2>
          <dl class="detail-list">
            <dt>Email</dt><dd>${member.email ? escapeHtml(member.email) : "No email on file"}</dd>
            <dt>Address</dt><dd>${escapeHtml(member.address).replaceAll("\n", "<br>") || "No address on file"}</dd>
            <dt>Dues frequency</dt><dd>${escapeHtml(frequencyLabel(member.dues_frequency))}</dd>
            <dt>Invoice includes</dt><dd>${escapeHtml(invoiceIncludedLabel(member.invoice_included) || "Not selected")}</dd>
            <dt>Fiscal year</dt><dd>${escapeHtml(settings.fiscal_year)}</dd>
            <dt>Dues rate</dt><dd>${formatMoney(settings.quarterly_dues_cents)} per quarter</dd>
            <dt>Meals</dt><dd>${formatMoney(settings.meal_cents)} per ${escapeHtml(settings.meeting_day)} meeting</dd>
          </dl>
        </div>
        <div class="content-band">
          <h2>Invoice preview</h2>
          <div class="table-wrap report-table">
            <table>
              <thead><tr><th>Description</th><th class="amount">Amount</th></tr></thead>
              <tbody>
                ${invoice.lineItems.map((item) => `<tr><td>${escapeHtml(item.description)}</td><td class="amount">${formatMoney(item.amountCents)}</td></tr>`).join("")}
              </tbody>
            </table>
          </div>
          ${reportTotal("Total due", invoice.totalCents)}
          <div class="form-actions dues-actions">
            <a href="/member-dues">Back to tracker</a>
            <a class="button-like" href="/member-dues/invoice.pdf?id=${encodeURIComponent(member.id)}">Create invoice PDF</a>
            ${member.email ? `<a class="button-like" href="${escapeHtml(memberInvoiceEmailHref(invoice))}">Open email draft</a>` : ""}
          </div>
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
  errors: Record<string, string> = {},
  organizationUsers: OrganizationUser[] = []
): Response {
  const canManageUsers = context.role === "owner" || context.role === "admin";
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
        <form method="post" action="/settings/organization-profile" class="form-card">
          <input type="hidden" name="csrfToken" value="${escapeHtml(context.csrfToken)}">
          <h2>Organization type</h2>
          <label>Layout
            <select name="organizationProfile">
              <option value="church"${selected(context.organization.organization_profile, "church")}>Church</option>
              <option value="rotary"${selected(context.organization.organization_profile, "rotary")}>Rotary / service club</option>
            </select>
            ${errorText(errors.organizationProfile)}
          </label>
          <button type="submit">Save organization type</button>
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
      + (canManageUsers ? organizationUsersPanel(context, organizationUsers, errors) : "")
  });
}

function organizationUsersPanel(
  context: AuthContext,
  organizationUsers: OrganizationUser[],
  errors: Record<string, string>
): string {
  const rows = organizationUsers.length
    ? organizationUsers
        .map(
          (user) => `<tr>
            <td>${escapeHtml(user.name)}</td>
            <td>${escapeHtml(user.email)}</td>
            <td>${formatStatus(user.role)}</td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="3" class="empty">No users have been added yet.</td></tr>`;

  return `<section class="content-band settings-users">
    <div>
      <p class="eyebrow">Access</p>
      <h2>Organization users</h2>
      <p class="muted">Add people who should sign in to ${escapeHtml(context.organization.name)} with their own email and password.</p>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Name</th><th>Email / username</th><th>Access level</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <form method="post" action="/settings/users" class="form-card settings-user-form">
      <input type="hidden" name="csrfToken" value="${escapeHtml(context.csrfToken)}">
      <h3>Add user</h3>
      <label>Name
        <input name="name" type="text" autocomplete="name" required>
        ${errorText(errors.userName)}
      </label>
      <label>Email / username
        <input name="email" type="email" autocomplete="email" required>
        ${errorText(errors.userEmail)}
      </label>
      <label>Temporary password
        <input name="password" type="password" autocomplete="new-password" minlength="12" required>
        ${errorText(errors.userPassword)}
      </label>
      <label>Access level
        <select name="role">
          <option value="viewer">Viewer - reports only</option>
          <option value="accountant">Accountant - transactions and reports</option>
          <option value="admin">Admin - settings and users</option>
        </select>
        ${errorText(errors.userRole)}
      </label>
      <button type="submit">Add user</button>
    </form>
  </section>`;
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
            <td><a href="/funds/detail?id=${encodeURIComponent(fund.id)}">${escapeHtml(fund.name)}</a></td>
            <td>${formatStatus(fund.status)}</td>
            <td class="budget-actions">
              <a class="button-like small-button" href="/funds/detail?id=${encodeURIComponent(fund.id)}">View report</a>
              <form method="post" action="/funds/update" class="table-edit-form">
                <input type="hidden" name="csrfToken" value="${escapeHtml(context.csrfToken)}">
                <input type="hidden" name="fundId" value="${escapeHtml(fund.id)}">
                <input name="name" type="text" value="${escapeHtml(fund.name)}" required>
                <button class="small-button" type="submit">Rename</button>
              </form>
              <form method="post" action="/funds/delete" class="table-edit-form">
                <input type="hidden" name="csrfToken" value="${escapeHtml(context.csrfToken)}">
                <input type="hidden" name="fundId" value="${escapeHtml(fund.id)}">
                <button class="danger-button small-button" type="submit">Remove</button>
              </form>
            </td>
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
            <thead><tr><th>Name</th><th>Status</th><th>Report</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>`
  });
}

export function fundDetailPage(appName: string, context: AuthContext, report: FundActivityReport, funds: Fund[]): Response {
  const rows = fundActivityRows(report.rows, funds, context.csrfToken, report.fund.id, true);
  const draftRows = fundActivityRows(report.draftRows, funds, context.csrfToken, report.fund.id, false);
  const draftNotice = report.draftRows.length
    ? `<section class="content-band report-section">
        <h2>Draft activity not included in balance</h2>
        <p class="muted">These draft entries are assigned to this fund, but they will not change the fund balance until they are posted.</p>
        <div class="metric-grid">
          <article class="metric"><span>Draft income</span><strong>${formatMoney(report.draftIncomeCents)}</strong></article>
          <article class="metric"><span>Draft expenses</span><strong>${formatMoney(report.draftExpenseCents)}</strong></article>
        </div>
        <div class="table-wrap report-table">
          <table>
            <thead><tr><th>Date</th><th>Entry</th><th>Description</th><th>Account</th><th>Type</th><th>Income</th><th>Expense</th><th>Correct fund</th></tr></thead>
            <tbody>${draftRows}</tbody>
          </table>
        </div>
      </section>`
    : `<section class="content-band report-section">
        <h2>Draft activity not included in balance</h2>
        <p class="muted">No draft revenue or expense entries are currently assigned to this fund.</p>
      </section>`;

  return layout({
    title: `${report.fund.name} Fund`,
    appName,
    context,
    body: `<section class="page-heading">
        <p class="eyebrow">${escapeHtml(context.organization.name)}</p>
        <h1>${escapeHtml(report.fund.name)}</h1>
        <p class="muted">Income increases this fund balance. Expenses assigned to this fund reduce it.</p>
      </section>
      <section class="metric-grid">
        <article class="metric"><span>Income</span><strong>${formatMoney(report.totalIncomeCents)}</strong></article>
        <article class="metric"><span>Expenses</span><strong>${formatMoney(report.totalExpenseCents)}</strong></article>
        <article class="metric"><span>Fund balance</span><strong>${formatMoney(report.balanceCents)}</strong></article>
      </section>
      <section class="content-band report-section">
        <div class="form-actions">
          <a href="/funds">Back to funds</a>
          <a class="button-like" href="/funds/detail.csv?id=${encodeURIComponent(report.fund.id)}">Download fund activity CSV</a>
        </div>
        <div class="table-wrap report-table">
          <table>
            <thead><tr><th>Date</th><th>Entry</th><th>Description</th><th>Account</th><th>Type</th><th>Income</th><th>Expense</th><th>Running balance</th><th>Correct fund</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>
      ${draftNotice}`
  });
}

function fundActivityRows(
  rows: FundActivityReport["rows"],
  funds: Fund[],
  csrfToken: string,
  currentFundId: string,
  includeRunningBalance: boolean
): string {
  if (rows.length === 0) {
    const colspan = includeRunningBalance ? 9 : 8;
    const message = includeRunningBalance
      ? "No posted revenue or expense activity for this fund yet."
      : "No draft revenue or expense activity for this fund yet.";
    return `<tr><td colspan="${colspan}" class="empty">${message}</td></tr>`;
  }

  return rows
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.entry_date)}</td>
        <td>${escapeHtml(row.entry_number)}</td>
        <td>${escapeHtml(row.line_description || row.entry_description)}</td>
        <td>${escapeHtml(`${row.account_number} - ${row.account_name}`)}</td>
        <td>${formatAccountType(row.account_type)}</td>
        <td class="amount">${row.account_type === "revenue" ? formatMoney(row.amount_cents) : ""}</td>
        <td class="amount">${row.account_type === "expense" ? formatMoney(row.amount_cents) : ""}</td>
        ${includeRunningBalance ? `<td class="amount">${formatMoney(row.running_balance_cents)}</td>` : ""}
        <td>
          <form method="post" action="/funds/activity/update" class="table-edit-form">
            <input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}">
            <input type="hidden" name="lineId" value="${escapeHtml(row.line_id)}">
            <input type="hidden" name="returnFundId" value="${escapeHtml(currentFundId)}">
            <select name="fundId">
              ${fundOptions(funds, currentFundId)}
            </select>
            <button class="small-button" type="submit">Move</button>
          </form>
        </td>
      </tr>`
    )
    .join("");
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
        <p class="muted">Enter one amount and category. The app handles the ledger details behind the scenes.</p>
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
        <label>Money account
          <select name="cashAccountId">
            ${accountOptions(cashAccounts, "No active asset or liability accounts")}
          </select>
          ${errorText(errors.cashAccountId)}
        </label>
        <label>Category
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
            <td><a class="button-like small-button" href="/journal-entries/edit?id=${encodeURIComponent(entry.id)}">Edit</a></td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="7" class="empty">No journal entries yet.</td></tr>`;

  return layout({
    title: "Advanced ledger",
    appName,
    context,
    body: `<section class="page-heading">
        <p class="eyebrow">${escapeHtml(context.organization.name)}</p>
        <h1>Advanced ledger</h1>
        <p class="muted">For regular income and expenses, use New transaction so you only enter one amount. Use this page only for manual accounting adjustments.</p>
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
        <h2>Recent ledger entries</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Entry</th><th>Date</th><th>Description</th><th>Status</th><th>Debits</th><th>Credits</th><th>Actions</th></tr></thead>
            <tbody>${entryRows}</tbody>
          </table>
        </div>
      </section>`
  });
}

export function journalEntryEditPage(
  appName: string,
  context: AuthContext,
  accounts: ChartAccount[],
  funds: Fund[],
  entry: JournalEntryDetail,
  error?: string
): Response {
  const editableLines = entry.lines.length > 0 ? entry.lines : emptyJournalLines();
  const totalDebit = editableLines.reduce((sum, line) => sum + line.debitAmountCents, 0);
  const totalCredit = editableLines.reduce((sum, line) => sum + line.creditAmountCents, 0);

  return layout({
    title: `Edit ${entry.entry_number}`,
    appName,
    context,
    body: `<section class="page-heading">
        <p class="eyebrow">${escapeHtml(context.organization.name)}</p>
        <h1>Edit journal entry</h1>
        <p class="muted">Change the account, fund, description, or amount. Debits and credits must still match before saving.</p>
      </section>
      <form method="post" action="/journal-entries/update" class="grid-form">
        <input type="hidden" name="csrfToken" value="${escapeHtml(context.csrfToken)}">
        <input type="hidden" name="entryId" value="${escapeHtml(entry.id)}">
        <input type="hidden" name="lineCount" value="${editableLines.length}">
        ${error ? `<p class="alert">${escapeHtml(error)}</p>` : ""}
        ${fieldWithValue("Date", "entryDate", "date", undefined, entry.entry_date)}
        ${fieldWithValue("Description", "description", "text", undefined, entry.description, "Payroll accrual")}
        ${editableLines.map((line, index) => journalEditLineFields(index + 1, line, accounts, funds)).join("")}
        <div class="report-total">
          <span>Total debits</span>
          <strong>${formatMoney(totalDebit)}</strong>
        </div>
        <div class="report-total">
          <span>Total credits</span>
          <strong>${formatMoney(totalCredit)}</strong>
        </div>
        <div class="form-actions">
          <a href="/journal-entries/new">Back</a>
          <button type="submit">Save changes</button>
          <button class="danger-button" type="submit" formaction="/journal-entries/delete">Delete entry</button>
        </div>
      </form>`
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
      ${reportNav()}
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
          ${report ? `<a class="button-like" href="${escapeHtml(statementOfActivitiesPdfUrl(report))}">Print statement PDF</a>` : ""}
          <button type="submit">Run report</button>
        </div>
      </form>
      ${
        report
          ? `<section class="content-band report-section">
              <h2>Revenue</h2>
              ${statementDetailRowsTable(report.revenueDetails)}
              ${reportTotal("Total revenue", report.totalRevenueCents)}
              <h2>Expenses</h2>
              ${statementDetailRowsTable(report.expenseDetails)}
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

export function balanceSheetPage(
  appName: string,
  context: AuthContext,
  funds: Fund[],
  report: BalanceSheetReport | null,
  errors: Record<string, string> = {}
): Response {
  return layout({
    title: "Balance Sheet",
    appName,
    context,
    body: `<section class="page-heading">
        <p class="eyebrow">${escapeHtml(context.organization.name)}</p>
        <h1>Balance Sheet</h1>
        <p class="muted">Assets, liabilities, and net assets from posted journal entries.</p>
      </section>
      ${reportNav()}
      <form method="get" action="/reports/balance-sheet" class="grid-form report-filter">
        ${dateFilterField("As of date", "asOfDate", errors.asOfDate, report?.filters.asOfDate)}
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
              <h2>Assets</h2>
              ${financialRowsTable(report.assets)}
              ${reportTotal("Total assets", report.totalAssetsCents)}
              <h2>Liabilities</h2>
              ${financialRowsTable(report.liabilities)}
              ${reportTotal("Total liabilities", report.totalLiabilitiesCents)}
              <h2>Net assets</h2>
              ${financialRowsTable([
                ...report.netAssets,
                ...(report.operatingChangeCents !== 0
                  ? [{
                      account_id: "current_change",
                      account_number: "",
                      account_name: "Current change in net assets",
                      account_type: "net_asset" as AccountType,
                      amount_cents: report.operatingChangeCents
                    }]
                  : [])
              ])}
              ${reportTotal("Total net assets", report.totalNetAssetsCents)}
              <div class="report-net">
                <span>Total liabilities and net assets</span>
                <strong>${formatMoney(report.totalLiabilitiesAndNetAssetsCents)}</strong>
              </div>
            </section>`
          : ""
      }`
  });
}

export function accountRegisterPage(
  appName: string,
  context: AuthContext,
  accounts: ChartAccount[],
  report: AccountRegisterReport | null,
  errors: Record<string, string> = {}
): Response {
  const selectedAccountId = report?.filters.accountId ?? "";

  return layout({
    title: "Account Register",
    appName,
    context,
    body: `<section class="page-heading">
        <p class="eyebrow">${escapeHtml(context.organization.name)}</p>
        <h1>Account Register</h1>
        <p class="muted">Deposits, payments, and running balance for one money account.</p>
      </section>
      ${reportNav()}
      <form method="get" action="/reports/account-register" class="grid-form report-filter">
        <label>Account
          <select name="accountId">
            ${accountOptions(accounts, "No active bank or liability accounts", selectedAccountId)}
          </select>
          ${errorText(errors.accountId)}
        </label>
        ${dateFilterField("Start date", "startDate", errors.startDate, report?.filters.startDate)}
        ${dateFilterField("End date", "endDate", errors.endDate, report?.filters.endDate)}
        <div class="form-actions">
          ${report ? `<a class="button-like" href="${escapeHtml(accountRegisterCsvUrl(report))}">Download CSV</a>` : ""}
          <button type="submit">Run report</button>
        </div>
      </form>
      ${
        report
          ? `<section class="content-band report-section">
              <div class="metric-grid">
                <div class="metric-card">
                  <span>Account</span>
                  <strong>${escapeHtml(report.account.account_number)} - ${escapeHtml(report.account.account_name)}</strong>
                </div>
                <div class="metric-card">
                  <span>Deposits / debits</span>
                  <strong>${formatMoney(report.totalDebitsCents)}</strong>
                </div>
                <div class="metric-card">
                  <span>Payments / credits</span>
                  <strong>${formatMoney(report.totalCreditsCents)}</strong>
                </div>
                <div class="metric-card">
                  <span>Ending balance</span>
                  <strong>${formatMoney(report.endingBalanceCents)}</strong>
                </div>
              </div>
              ${accountRegisterTable(report)}
            </section>`
          : ""
      }`
  });
}

export function incomeStatementPage(
  appName: string,
  context: AuthContext,
  funds: Fund[],
  report: IncomeStatementReport | null,
  errors: Record<string, string> = {}
): Response {
  return layout({
    title: "Income Statement",
    appName,
    context,
    body: `<section class="page-heading">
        <p class="eyebrow">${escapeHtml(context.organization.name)}</p>
        <h1>Income Statement</h1>
        <p class="muted">Revenue, expenses, and net income from posted journal entries.</p>
      </section>
      ${reportNav()}
      <form method="get" action="/reports/income-statement" class="grid-form report-filter">
        ${dateFilterField("Start date", "startDate", errors.startDate, report?.filters.startDate)}
        ${dateFilterField("End date", "endDate", errors.endDate, report?.filters.endDate)}
        <label>Fund
          <select name="fundId">
            <option value="">All funds</option>
            ${fundOptions(funds, report?.filters.fundId)}
          </select>
        </label>
        <div class="form-actions">
          ${report ? `<a class="button-like" href="${escapeHtml(incomeStatementPdfUrl(report))}">Print income statement PDF</a>` : ""}
          <button type="submit">Run report</button>
        </div>
      </form>
      ${
        report
          ? `<section class="content-band report-section">
              <h2>Revenue</h2>
              ${financialRowsTable(report.revenues)}
              ${reportTotal("Total revenue", report.totalRevenueCents)}
              <h2>Expenses</h2>
              ${financialRowsTable(report.expenses)}
              ${reportTotal("Total expenses", report.totalExpenseCents)}
              <div class="report-net">
                <span>Net income</span>
                <strong>${formatMoney(report.netIncomeCents)}</strong>
              </div>
            </section>`
          : ""
      }`
  });
}

export function budgetVsActualPage(
  appName: string,
  context: AuthContext,
  funds: Fund[],
  accounts: ChartAccount[],
  report: BudgetVsActualReport | null,
  errors: Record<string, string> = {}
): Response {
  const budgetAccounts = accounts.filter(
    (account) => account.status === "active" && ["revenue", "expense"].includes(account.account_type)
  );
  const year = report?.filters.fiscalYear ?? new Date().getFullYear();

  return layout({
    title: "Budget vs Actual",
    appName,
    context,
    body: `<section class="page-heading">
        <p class="eyebrow">${escapeHtml(context.organization.name)}</p>
        <h1>Budget vs Actual</h1>
        <p class="muted">Compare budget lines with posted revenue and expense activity.</p>
      </section>
      ${reportNav()}
      <section class="split">
        <form method="get" action="/reports/budget-vs-actual" class="form-card">
          ${fieldWithValue("Fiscal year", "fiscalYear", "number", errors.fiscalYear, String(year), "2026")}
          ${dateFilterField("Start date", "startDate", errors.startDate, report?.filters.startDate)}
          ${dateFilterField("End date", "endDate", errors.endDate, report?.filters.endDate)}
          <label>Fund
            <select name="fundId">
              <option value="">All funds</option>
              ${fundOptions(funds, report?.filters.fundId)}
            </select>
          </label>
          <button type="submit">Run report</button>
        </form>
        <form method="post" action="/reports/budget-lines" class="form-card">
          <input type="hidden" name="csrfToken" value="${escapeHtml(context.csrfToken)}">
          <h2>Add budget line</h2>
          ${fieldWithValue("Fiscal year", "fiscalYear", "number", errors.fiscalYear, String(year), "2026")}
          <label>Account
            <select name="accountId">
              ${accountOptions(budgetAccounts, "No active revenue or expense accounts")}
            </select>
            ${errorText(errors.accountId)}
          </label>
          <label>Fund
            <select name="fundId">
              <option value="">All funds</option>
              ${fundOptions(funds)}
            </select>
            ${errorText(errors.fundId)}
          </label>
          <label>Budget amount
            <input name="amount" type="number" min="0" step="0.01" placeholder="0.00" required>
            ${errorText(errors.amount)}
          </label>
          <button type="submit">Add budget line</button>
        </form>
      </section>
      ${
        report
          ? `<section class="content-band report-section">
              ${budgetVsActualTable(report.rows)}
              ${reportTotal("Total budget", report.totalBudgetCents)}
              ${reportTotal("Total actual", report.totalActualCents)}
              <div class="report-net">
                <span>Total variance</span>
                <strong>${formatMoney(report.totalVarianceCents)}</strong>
              </div>
            </section>`
          : ""
      }`
  });
}

export function budgetPage(
  appName: string,
  context: AuthContext,
  funds: Fund[],
  accounts: ChartAccount[],
  budgetLines: BudgetLineRecord[],
  fiscalYear: number,
  errors: Record<string, string> = {}
): Response {
  const budgetAccounts = accounts.filter(
    (account) => account.status === "active" && ["revenue", "expense"].includes(account.account_type)
  );

  return layout({
    title: "Budget",
    appName,
    context,
    body: `<section class="page-heading">
        <p class="eyebrow">${escapeHtml(context.organization.name)}</p>
        <h1>Budget</h1>
        <p class="muted">Update the annual Rotary budget, save changes, and print the latest budget PDF.</p>
      </section>
      <section class="split">
        <form method="get" action="/budget" class="form-card">
          ${fieldWithValue("Fiscal year", "fiscalYear", "number", errors.fiscalYear, String(fiscalYear), "2026")}
          <div class="form-actions">
            <a class="button-like" href="/budget/report.pdf?fiscalYear=${encodeURIComponent(String(fiscalYear))}">Print budget PDF</a>
            <button type="submit">Open year</button>
          </div>
        </form>
        <form method="post" action="/budget" class="form-card">
          <input type="hidden" name="csrfToken" value="${escapeHtml(context.csrfToken)}">
          <h2>Add budget line</h2>
          ${fieldWithValue("Fiscal year", "fiscalYear", "number", errors.fiscalYear, String(fiscalYear), "2026")}
          <label>Account
            <select name="accountId">
              ${accountOptions(budgetAccounts, "No active revenue or expense accounts")}
            </select>
            ${errorText(errors.accountId)}
          </label>
          <label>Fund
            <select name="fundId">
              <option value="">No fund</option>
              ${fundOptions(funds)}
            </select>
            ${errorText(errors.fundId)}
          </label>
          <label>Budget amount
            <input name="amount" type="number" min="0" step="0.01" placeholder="0.00" required>
            ${errorText(errors.amount)}
          </label>
          <button type="submit">Add budget line</button>
        </form>
      </section>
      <section class="content-band report-section budget-editor">
        <h2>Editable budget lines</h2>
        ${errors.budgetLineId ? `<p class="alert">${escapeHtml(errors.budgetLineId)}</p>` : ""}
        ${budgetLineTable(budgetLines, budgetAccounts, funds, context.csrfToken)}
      </section>`
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
  headers.set("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");

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

function fieldWithValue(labelText: string, name: string, type: string, error?: string, value = "", placeholder = ""): string {
  return `<label>${escapeHtml(labelText)}
    <input name="${escapeHtml(name)}" type="${escapeHtml(type)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" required>
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

function fiscalYearOptions(current: string): string {
  return ["2025-2026", "2026-2027", "2027-2028", "2028-2029"]
    .map((year) => `<option value="${year}"${selected(current, year)}>${year}</option>`)
    .join("");
}

function meetingDayOptions(current: string): string {
  return ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    .map((day) => `<option value="${day}"${selected(current, day)}>${day}</option>`)
    .join("");
}

function accountOptions(accounts: ChartAccount[], emptyText: string, selectedAccountId = ""): string {
  if (accounts.length === 0) {
    return `<option value="">${escapeHtml(emptyText)}</option>`;
  }

  return accounts
    .map(
      (account) => {
        const optionSelected = account.id === selectedAccountId ? " selected" : "";
        return `<option value="${escapeHtml(account.id)}"${optionSelected}>${escapeHtml(account.account_number)} - ${escapeHtml(account.account_name)}</option>`;
      }
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

function journalEditLineFields(lineNumber: number, line: JournalEntryLineRecord, accounts: ChartAccount[], funds: Fund[]): string {
  return `<fieldset class="line-set">
    <legend>Line ${lineNumber}</legend>
    <label>Account
      <select name="line${lineNumber}AccountId">
        ${accountOptions(accounts, "No active accounts", line.accountId)}
      </select>
    </label>
    <label>Fund
      <select name="line${lineNumber}FundId">
        <option value="">No fund</option>
        ${fundOptions(funds, line.fundId ?? "")}
      </select>
    </label>
    <label>Description
      <input name="line${lineNumber}Description" type="text" value="${escapeHtml(line.description ?? "")}">
    </label>
    <label>Debit
      <input name="line${lineNumber}Debit" type="number" min="0" step="0.01" value="${line.debitAmountCents > 0 ? centsInputValue(line.debitAmountCents) : ""}" placeholder="0.00">
    </label>
    <label>Credit
      <input name="line${lineNumber}Credit" type="number" min="0" step="0.01" value="${line.creditAmountCents > 0 ? centsInputValue(line.creditAmountCents) : ""}" placeholder="0.00">
    </label>
  </fieldset>`;
}

function emptyJournalLines(): JournalEntryLineRecord[] {
  return [
    {
      id: "line_1",
      line_number: 1,
      accountId: "",
      fundId: undefined,
      description: "",
      debitAmountCents: 0,
      creditAmountCents: 0
    },
    {
      id: "line_2",
      line_number: 2,
      accountId: "",
      fundId: undefined,
      description: "",
      debitAmountCents: 0,
      creditAmountCents: 0
    }
  ];
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

function memberDuesRow(member: MemberDuesRecord, csrfToken: string): string {
  const formId = `dues-${member.id}`;
  return `<tr>
    <td class="dues-member-name">
      <form id="${escapeHtml(formId)}" method="post" action="/member-dues/update">
        <input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}">
        <input type="hidden" name="id" value="${escapeHtml(member.id)}">
        <input type="hidden" name="memberName" value="${escapeHtml(member.member_name)}">
      </form>
      <a href="/member-dues/member?id=${encodeURIComponent(member.id)}">${escapeHtml(member.member_name).replaceAll("\n", "<br>")}</a>
    </td>
    <td>
      <input class="dues-email-input" form="${escapeHtml(formId)}" name="email" type="email" value="${escapeHtml(member.email)}" aria-label="Email for ${escapeHtml(member.member_name)}">
    </td>
    <td><textarea form="${escapeHtml(formId)}" name="address" rows="2" aria-label="Address for ${escapeHtml(member.member_name)}">${escapeHtml(member.address)}</textarea></td>
    <td>
      <select form="${escapeHtml(formId)}" class="dues-pill dues-pill-frequency" name="duesFrequency" aria-label="Dues frequency for ${escapeHtml(member.member_name)}">
        <option value=""${selected(member.dues_frequency, "")}></option>
        <option value="annual"${selected(member.dues_frequency, "annual")}>Annual</option>
        <option value="semi_annual"${selected(member.dues_frequency, "semi_annual")}>Semi-Annual</option>
        <option value="quarterly"${selected(member.dues_frequency, "quarterly")}>Quarterly</option>
      </select>
    </td>
    <td>
      <select form="${escapeHtml(formId)}" class="dues-pill dues-pill-included" name="invoiceIncluded" aria-label="Invoice includes for ${escapeHtml(member.member_name)}">
        <option value=""${selected(member.invoice_included, "")}></option>
        <option value="dues_only"${selected(member.invoice_included, "dues_only")}>Dues Only</option>
        <option value="dues_and_meals"${selected(member.invoice_included, "dues_and_meals")}>Dues and Meals</option>
      </select>
    </td>
    <td class="dues-check"><input form="${escapeHtml(formId)}" name="q1Paid" type="checkbox"${checked(member.q1_paid)} aria-label="Q1 paid for ${escapeHtml(member.member_name)}"></td>
    <td class="dues-check"><input form="${escapeHtml(formId)}" name="q2Paid" type="checkbox"${checked(member.q2_paid)} aria-label="Q2 paid for ${escapeHtml(member.member_name)}"></td>
    <td class="dues-check"><input form="${escapeHtml(formId)}" name="q3Paid" type="checkbox"${checked(member.q3_paid)} aria-label="Q3 paid for ${escapeHtml(member.member_name)}"></td>
    <td class="dues-check"><input form="${escapeHtml(formId)}" name="q4Paid" type="checkbox"${checked(member.q4_paid)} aria-label="Q4 paid for ${escapeHtml(member.member_name)}"></td>
    <td><textarea form="${escapeHtml(formId)}" name="notes" rows="2" aria-label="Notes for ${escapeHtml(member.member_name)}">${escapeHtml(member.notes)}</textarea></td>
    <td class="dues-save"><button form="${escapeHtml(formId)}" class="small-button" type="submit">Save</button></td>
  </tr>`;
}

function memberDuesColumnControls(): string {
  const controls = [
    ["Member", "--dues-col-member-width", 250],
    ["Email", "--dues-col-email-width", 520],
    ["Address", "--dues-col-address-width", 380],
    ["Frequency", "--dues-col-frequency-width", 210],
    ["Invoice type", "--dues-col-included-width", 220],
    ["Q1", "--dues-col-q1-width", 105],
    ["Q2", "--dues-col-q2-width", 105],
    ["Q3", "--dues-col-q3-width", 105],
    ["Q4", "--dues-col-q4-width", 105],
    ["Notes", "--dues-col-notes-width", 560],
    ["Save", "--dues-col-save-width", 130]
  ] as const;

  return controls
    .map(([label, property, width], index) => `<label>${escapeHtml(label)}
      <input type="number" min="70" max="900" step="10" value="${width}" data-width-control data-width-property="${property}" data-width-column="${index}">
    </label>`)
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

function statementDetailRowsTable(rows: StatementOfActivitiesDetailRow[]): string {
  const body = rows.length
    ? rows
        .map((row) => {
          const description = row.line_description || row.entry_description;
          return `<tr>
            <td>${escapeHtml(row.entry_date)}</td>
            <td>${escapeHtml(row.entry_number)}</td>
            <td>${escapeHtml(row.account_number)}</td>
            <td>${escapeHtml(row.account_name)}</td>
            <td>${escapeHtml(description)}</td>
            <td class="amount">${formatMoney(row.amount_cents)}</td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="6" class="empty">No activity.</td></tr>`;

  return `<div class="table-wrap report-table">
    <table>
      <thead><tr><th>Date</th><th>Entry</th><th>Account</th><th>Name</th><th>Description</th><th>Amount</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
  </div>`;
}

function financialRowsTable(rows: FinancialReportRow[]): string {
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

function accountRegisterTable(report: AccountRegisterReport): string {
  const body = report.rows.length
    ? report.rows
        .map(
          (row) => `<tr>
            <td>${escapeHtml(row.entry_date)}</td>
            <td>${escapeHtml(row.entry_number)}</td>
            <td>${escapeHtml(row.line_description || row.entry_description)}</td>
            <td class="amount">${row.debit_amount_cents > 0 ? formatMoney(row.debit_amount_cents) : ""}</td>
            <td class="amount">${row.credit_amount_cents > 0 ? formatMoney(row.credit_amount_cents) : ""}</td>
            <td class="amount">${formatMoney(row.running_balance_cents)}</td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="6" class="empty">No posted transactions for this account in the selected dates.</td></tr>`;

  return `<div class="table-wrap report-table">
    <table>
      <thead><tr><th>Date</th><th>Entry</th><th>Description</th><th>Deposit / debit</th><th>Payment / credit</th><th>Running balance</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
  </div>`;
}

function budgetVsActualTable(rows: BudgetVsActualRow[]): string {
  const body = rows.length
    ? rows
        .map(
          (row) => `<tr>
            <td>${escapeHtml(row.account_number)}</td>
            <td>${escapeHtml(row.account_name)}</td>
            <td>${formatAccountType(row.account_type)}</td>
            <td class="amount">${formatMoney(row.budget_cents)}</td>
            <td class="amount">${formatMoney(row.actual_cents)}</td>
            <td class="amount">${formatMoney(row.variance_cents)}</td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="6" class="empty">No budget or actual activity.</td></tr>`;

  return `<div class="table-wrap report-table">
    <table>
      <thead><tr><th>Account</th><th>Name</th><th>Type</th><th>Budget</th><th>Actual</th><th>Variance</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
  </div>`;
}

function budgetLineTable(rows: BudgetLineRecord[], accounts: ChartAccount[], funds: Fund[], csrfToken: string): string {
  const body = rows.length
    ? rows
        .map(
          (row) => {
            const formId = `budget-form-${row.id}`;
            return `<tr>
            <td>
                <input form="${escapeHtml(formId)}" name="fiscalYear" type="number" min="2000" max="2100" value="${escapeHtml(String(row.fiscal_year))}" required>
            </td>
            <td>
                <select form="${escapeHtml(formId)}" name="accountId">
                  ${accountOptions(accounts, "No active revenue or expense accounts", row.account_id)}
                </select>
            </td>
            <td>
                <select form="${escapeHtml(formId)}" name="fundId">
                  <option value="">No fund</option>
                  ${fundOptions(funds, row.fund_id ?? "")}
                </select>
            </td>
            <td>
                <input form="${escapeHtml(formId)}" name="amount" type="number" min="0" step="0.01" value="${centsInputValue(row.amount_cents)}" required>
            </td>
            <td class="budget-actions">
              <form id="${escapeHtml(formId)}" method="post" action="/budget/update" class="table-edit-form">
                <input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}">
                <input type="hidden" name="budgetLineId" value="${escapeHtml(row.id)}">
                <button class="small-button" type="submit">Save</button>
                <button class="danger-button small-button" type="submit" formaction="/budget/delete">Delete</button>
              </form>
            </td>
          </tr>`;
          }
        )
        .join("")
    : `<tr><td colspan="5" class="empty">No budget lines for this year yet.</td></tr>`;

  return `<div class="table-wrap report-table">
    <table>
      <thead><tr><th>Year</th><th>Account</th><th>Fund</th><th>Amount</th><th>Actions</th></tr></thead>
      <tbody>${body}</tbody>
    </table>
  </div>`;
}

function reportNav(): string {
  return `<nav class="report-nav" aria-label="Financial reports">
    <a href="/reports/balance-sheet">Balance Sheet</a>
    <a href="/reports/account-register">Account Register</a>
    <a href="/reports/income-statement">Income Statement</a>
    <a href="/reports/statement-of-activities">Statement of Activities</a>
    <a href="/budget">Budget</a>
    <a href="/reports/budget-vs-actual">Budget vs Actual</a>
  </nav>`;
}

function accountRegisterCsvUrl(report: AccountRegisterReport): string {
  const params = new URLSearchParams();
  params.set("accountId", report.filters.accountId);
  if (report.filters.startDate) params.set("startDate", report.filters.startDate);
  if (report.filters.endDate) params.set("endDate", report.filters.endDate);
  return `/reports/account-register.csv?${params.toString()}`;
}

function incomeStatementPdfUrl(report: IncomeStatementReport): string {
  const params = new URLSearchParams();
  if (report.filters.startDate) params.set("startDate", report.filters.startDate);
  if (report.filters.endDate) params.set("endDate", report.filters.endDate);
  if (report.filters.fundId) params.set("fundId", report.filters.fundId);
  const query = params.toString();
  return `/reports/income-statement.pdf${query ? `?${query}` : ""}`;
}

function statementOfActivitiesPdfUrl(report: StatementOfActivitiesReport): string {
  const params = new URLSearchParams();
  if (report.filters.startDate) params.set("startDate", report.filters.startDate);
  if (report.filters.endDate) params.set("endDate", report.filters.endDate);
  if (report.filters.fundId) params.set("fundId", report.filters.fundId);
  params.set("pdf", "detail-v2");
  const query = params.toString();
  return `/reports/statement-of-activities.pdf${query ? `?${query}` : ""}`;
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

function formatOrganizationProfile(profile: string): string {
  return profile === "rotary" ? "Rotary / service club" : "Church";
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

function organizationProfileContent(context: AuthContext): {
  heading: string;
  description: string;
  moduleTitle: string;
  tasks: Array<{ href: string; label: string }>;
} {
  if (context.organization.organization_profile === "rotary") {
    return {
      heading: "Rotary accounting dashboard",
      description: "Track dues, event income, fundraisers, grants, service projects, and club expenses.",
      moduleTitle: "Rotary modules",
      tasks: [
        { href: "/funds", label: "Service projects and grants" },
        { href: "/member-dues", label: "Member dues tracking" },
        { href: "/transactions/new", label: "Dues and event income" },
        { href: "/budget", label: "Edit and print budget" },
        { href: "/reports/budget-vs-actual", label: "Budget vs actual" }
      ]
    };
  }

  return {
    heading: "Church accounting dashboard",
    description: "Track tithes, offerings, restricted gifts, ministry funds, payroll, and church expenses.",
    moduleTitle: "Church modules",
    tasks: [
      { href: "/funds", label: "Funds, ministries, and restrictions" },
      { href: "/payroll", label: "Payroll" },
      { href: "/reports/statement-of-activities", label: "Statement of activities" }
    ]
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
