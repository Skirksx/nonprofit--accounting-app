import type { AccountType, AuthContext, NormalBalance } from "./types";

type AccountRow = {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  normal_balance: NormalBalance;
  is_active: number;
};

export function layout(options: {
  title: string;
  appName: string;
  body: string;
  context?: AuthContext;
}): Response {
  const navigation = options.context
    ? `<nav class="nav">
        <a href="/dashboard">Dashboard</a>
        <a href="/accounts">Chart of accounts</a>
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
    body: `<section class="page-heading">
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
        <h2>Next foundation pieces</h2>
        <div class="task-list">
          <span>Funds and restrictions</span>
          <span>Journal entries</span>
          <span>Grant tracking</span>
          <span>Financial reports</span>
        </div>
      </section>`
  });
}

export function accountsPage(
  appName: string,
  context: AuthContext,
  accounts: AccountRow[],
  errors: Record<string, string> = {}
): Response {
  const rows = accounts.length
    ? accounts
        .map(
          (account) => `<tr>
            <td>${escapeHtml(account.code)}</td>
            <td>${escapeHtml(account.name)}</td>
            <td>${formatAccountType(account.type)}</td>
            <td>${escapeHtml(account.normal_balance)}</td>
            <td>${account.is_active ? "Active" : "Inactive"}</td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="5" class="empty">No accounts yet.</td></tr>`;

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
          ${field("Code", "code", "text", errors.code, "4000")}
          ${field("Name", "name", "text", errors.name, "Individual Contributions")}
          <label>Type
            <select name="type">
              <option value="asset">Asset</option>
              <option value="liability">Liability</option>
              <option value="net_asset">Net asset</option>
              <option value="revenue">Revenue</option>
              <option value="expense">Expense</option>
            </select>
            ${errorText(errors.type)}
          </label>
          <label>Normal balance
            <select name="normalBalance">
              <option value="debit">Debit</option>
              <option value="credit">Credit</option>
            </select>
            ${errorText(errors.normalBalance)}
          </label>
          <button type="submit">Add account</button>
        </form>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Normal</th><th>Status</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
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
  headers.set("Content-Security-Policy", "default-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");

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

function formatAccountType(type: AccountType): string {
  return type
    .split("_")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
