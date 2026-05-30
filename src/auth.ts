import { randomId, verifyPassword } from "./crypto.ts";
import type { AuthContext, Env, Role, User } from "./types.ts";

const SESSION_COOKIE = "np_session";
const SESSION_DAYS = 7;
const ROLE_RANK: Record<Role, number> = {
  viewer: 1,
  accountant: 2,
  admin: 3,
  owner: 4
};

type StoredUser = User & {
  password_hash: string;
  password_salt: string;
  password_iterations: number;
};

export async function attemptLogin(
  env: Env,
  email: string,
  password: string,
  secureCookie: boolean
): Promise<{ user: User; cookie: string; csrfToken: string } | null> {
  const user = await env.DB.prepare(
    "SELECT id, email, name, password_hash, password_salt, password_iterations FROM users WHERE email = ?"
  )
    .bind(email)
    .first<StoredUser>();

  if (!user) return null;

  const passwordMatches = await verifyPassword(
    password,
    user.password_hash,
    user.password_salt,
    user.password_iterations
  );

  if (!passwordMatches) return null;

  const sessionId = randomId("ses");
  const csrfToken = randomId("csrf");
  const expiresAt = sqlTimestamp(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await env.DB.prepare(
    "INSERT INTO sessions (id, user_id, csrf_token, expires_at) VALUES (?, ?, ?, ?)"
  )
    .bind(sessionId, user.id, csrfToken, expiresAt)
    .run();

  return {
    user: { id: user.id, email: user.email, name: user.name },
    cookie: serializeCookie(SESSION_COOKIE, sessionId, SESSION_DAYS * 24 * 60 * 60, secureCookie),
    csrfToken
  };
}

export async function requireAuth(request: Request, env: Env): Promise<AuthContext | Response> {
  const sessionId = getCookie(request, SESSION_COOKIE);
  if (!sessionId) return redirect("/login");

  const context = await env.DB.prepare(
    `SELECT
      users.id AS user_id,
      users.email AS user_email,
      users.name AS user_name,
      organizations.id AS organization_id,
      organizations.name AS organization_name,
      organizations.fiscal_year_start_month,
      organizations.base_currency,
      COALESCE(organizations.organization_profile, 'church') AS organization_profile,
      organizations.logo_data_url,
      organization_members.role,
      sessions.csrf_token
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    JOIN organization_members ON organization_members.user_id = users.id
    JOIN organizations ON organizations.id = organization_members.organization_id
    WHERE sessions.id = ? AND sessions.expires_at > CURRENT_TIMESTAMP
    ORDER BY organization_members.created_at ASC
    LIMIT 1`
  )
    .bind(sessionId)
    .first<{
      user_id: string;
      user_email: string;
      user_name: string;
      organization_id: string;
      organization_name: string;
      fiscal_year_start_month: number;
      base_currency: string;
      organization_profile: "church" | "rotary";
      logo_data_url: string | null;
      role: Role;
      csrf_token: string;
    }>();

  if (!context) return redirect("/login", clearSessionCookie());

  return {
    user: {
      id: context.user_id,
      email: context.user_email,
      name: context.user_name
    },
    organization: {
      id: context.organization_id,
      name: context.organization_name,
      fiscal_year_start_month: context.fiscal_year_start_month,
      base_currency: context.base_currency,
      organization_profile: context.organization_profile,
      logo_data_url: context.logo_data_url
    },
    role: context.role,
    csrfToken: context.csrf_token
  };
}

export function requireRole(context: AuthContext, minimumRole: Role): Response | null {
  if (ROLE_RANK[context.role] < ROLE_RANK[minimumRole]) {
    return new Response("Forbidden", { status: 403 });
  }

  return null;
}

export async function logout(request: Request, env: Env): Promise<Response> {
  const sessionId = getCookie(request, SESSION_COOKIE);
  if (sessionId) {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
  }

  return redirect("/login", clearSessionCookie());
}

export function validateCsrf(request: Request, form: FormData, context: AuthContext): Response | null {
  const submitted = form.get("csrfToken");
  if (typeof submitted !== "string" || submitted !== context.csrfToken) {
    return new Response("Invalid security token", { status: 400 });
  }

  return null;
}

export function redirect(location: string, cookie?: string): Response {
  const headers = new Headers({ Location: location });
  if (cookie) headers.set("Set-Cookie", cookie);
  return new Response(null, { status: 303, headers });
}

export function getCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get("Cookie");
  if (!cookie) return null;

  const value = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  return value ? decodeURIComponent(value.slice(name.length + 1)) : null;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function serializeCookie(name: string, value: string, maxAgeSeconds: number, secureCookie: boolean): string {
  const secure = secureCookie ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

function sqlTimestamp(value: number): string {
  return new Date(value).toISOString().slice(0, 19).replace("T", " ");
}
