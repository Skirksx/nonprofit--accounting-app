export type Env = {
  DB: D1Database;
  APP_NAME: string;
};

export type Role = "owner" | "admin" | "accountant" | "viewer";

export type AccountType = "asset" | "liability" | "net_asset" | "revenue" | "expense";

export type NormalBalance = "debit" | "credit";

export type User = {
  id: string;
  email: string;
  name: string;
};

export type Organization = {
  id: string;
  name: string;
  fiscal_year_start_month: number;
  base_currency: string;
};

export type AuthContext = {
  user: User;
  organization: Organization;
  role: Role;
  csrfToken: string;
};

export type RouteHandler = (
  request: Request,
  env: Env,
  params: Record<string, string>
) => Promise<Response> | Response;
