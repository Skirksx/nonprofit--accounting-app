import { attemptLogin, logout, redirect, requireAuth, requireRole, validateCsrf } from "./auth";
import { hashPassword, randomId } from "./crypto";
import { styles } from "./styles";
import type { Env, RouteHandler } from "./types";
import { validateAccount, validateLogin, validateSetup } from "./validation";
import {
  accountsPage,
  dashboardPage,
  loginPage,
  organizationAlreadyConfiguredPage,
  setupPage
} from "./views";

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

  const login = await attemptLogin(env, result.data.email, result.data.password);
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
      "INSERT INTO organizations (id, name, fiscal_year_start_month, base_currency) VALUES (?, ?, ?, ?)"
    ).bind(organizationId, result.data.organizationName, result.data.fiscalYearStartMonth, "USD"),
    env.DB.prepare(
      "INSERT INTO users (id, email, name, password_hash, password_salt, password_iterations) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(userId, result.data.email, result.data.name, password.hash, password.salt, password.iterations),
    env.DB.prepare(
      "INSERT INTO organization_members (organization_id, user_id, role) VALUES (?, ?, ?)"
    ).bind(organizationId, userId, "owner")
  ];

  await env.DB.batch(batch);

  const login = await attemptLogin(env, result.data.email, result.data.password);
  return redirect("/dashboard", login?.cookie);
}

async function getDashboard(request: Request, env: Env): Promise<Response> {
  const context = await requireAuth(request, env);
  if (context instanceof Response) return context;

  const stats = await env.DB.prepare(
    `SELECT
      COUNT(*) AS accountCount,
      SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS activeAccountCount
    FROM accounts
    WHERE organization_id = ?`
  )
    .bind(context.organization.id)
    .first<{ accountCount: number; activeAccountCount: number | null }>();

  return dashboardPage(env.APP_NAME, context, {
    accountCount: stats?.accountCount ?? 0,
    activeAccountCount: stats?.activeAccountCount ?? 0
  });
}

async function getAccounts(request: Request, env: Env): Promise<Response> {
  const context = await requireAuth(request, env);
  if (context instanceof Response) return context;

  const accounts = await loadAccounts(env, context.organization.id);
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
    const accounts = await loadAccounts(env, context.organization.id);
    return accountsPage(env.APP_NAME, context, accounts, result.errors);
  }

  try {
    await env.DB.prepare(
      `INSERT INTO accounts (id, organization_id, code, name, type, normal_balance)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(
        randomId("acct"),
        context.organization.id,
        result.data.code,
        result.data.name,
        result.data.type,
        result.data.normalBalance
      )
      .run();
  } catch (error) {
    const accounts = await loadAccounts(env, context.organization.id);
    return accountsPage(env.APP_NAME, context, accounts, {
      code: "That account code already exists."
    });
  }

  return redirect("/accounts");
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

async function loadAccounts(env: Env, organizationId: string) {
  const result = await env.DB.prepare(
    `SELECT id, code, name, type, normal_balance, is_active
     FROM accounts
     WHERE organization_id = ?
     ORDER BY code ASC`
  )
    .bind(organizationId)
    .all<{
      id: string;
      code: string;
      name: string;
      type: "asset" | "liability" | "net_asset" | "revenue" | "expense";
      normal_balance: "debit" | "credit";
      is_active: number;
    }>();

  return result.results ?? [];
}
