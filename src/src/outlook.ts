import { randomId } from "./crypto.ts";
import type { AuthContext, Env } from "./types.ts";

const outlookScopes = ["offline_access", "User.Read", "Mail.ReadWrite"];
const defaultTenant = "consumers";
const graphBaseUrl = "https://graph.microsoft.com/v1.0";

export type OutlookConnectionStatus = {
  connected: boolean;
  accountEmail?: string;
  displayName?: string;
  error?: string;
};

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
};

type OutlookConnectionRow = {
  organization_id: string;
  user_id: string;
  account_email: string;
  display_name: string;
  access_token_ciphertext: string;
  refresh_token_ciphertext: string;
  access_token_expires_at: string;
};

export async function getOutlookConnectionStatus(env: Env, organizationId: string): Promise<OutlookConnectionStatus> {
  const config = outlookConfig(env);
  if (!config.ok) return { connected: false, error: config.error };

  const connection = await getOutlookConnection(env, organizationId);
  if (!connection) return { connected: false };

  return {
    connected: true,
    accountEmail: connection.account_email,
    displayName: connection.display_name
  };
}

export async function startOutlookConnect(request: Request, env: Env, context: AuthContext): Promise<Response> {
  const config = outlookConfig(env);
  if (!config.ok) return new Response(config.error, { status: 500 });

  const state = randomId("ms");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await env.DB.prepare(
    "INSERT INTO outlook_oauth_states (state, organization_id, user_id, expires_at) VALUES (?, ?, ?, ?)"
  )
    .bind(state, context.organization.id, context.user.id, expiresAt)
    .run();

  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    redirect_uri: outlookRedirectUri(request),
    response_mode: "query",
    scope: outlookScopes.join(" "),
    state,
    login_hint: "Sbkirk@outlook.com"
  });

  return Response.redirect(`${microsoftBaseUrl(env)}/oauth2/v2.0/authorize?${params.toString()}`, 303);
}

export async function finishOutlookConnect(request: Request, env: Env, context: AuthContext): Promise<Response> {
  const config = outlookConfig(env);
  if (!config.ok) return new Response(config.error, { status: 500 });

  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  if (!code || !state) return Response.redirect(new URL("/settings?outlook=missing", request.url).toString(), 303);

  const stateRow = await env.DB.prepare(
    `SELECT state, organization_id, user_id
     FROM outlook_oauth_states
     WHERE state = ? AND expires_at > CURRENT_TIMESTAMP`
  )
    .bind(state)
    .first<{ state: string; organization_id: string; user_id: string }>();

  if (!stateRow || stateRow.organization_id !== context.organization.id || stateRow.user_id !== context.user.id) {
    return Response.redirect(new URL("/settings?outlook=invalid", request.url).toString(), 303);
  }

  await env.DB.prepare("DELETE FROM outlook_oauth_states WHERE state = ?").bind(state).run();

  const token = await requestToken(env, {
    grant_type: "authorization_code",
    code,
    redirect_uri: outlookRedirectUri(request),
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: outlookScopes.join(" ")
  });
  if (!token.refresh_token) return Response.redirect(new URL("/settings?outlook=token", request.url).toString(), 303);

  const profile = await graphGetMe(token.access_token);
  const accountEmail = profile.mail || profile.userPrincipalName || "Sbkirk@outlook.com";
  await saveOutlookConnection(env, context, {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresIn: token.expires_in ?? 3600,
    accountEmail,
    displayName: profile.displayName ?? "Stephen Kirk"
  });

  return Response.redirect(new URL("/settings?outlook=connected", request.url).toString(), 303);
}

export async function disconnectOutlook(env: Env, organizationId: string): Promise<void> {
  await env.DB.prepare("DELETE FROM outlook_connections WHERE organization_id = ?").bind(organizationId).run();
}

export async function createOutlookInvoiceDraft(
  env: Env,
  organizationId: string,
  input: {
    to: string;
    subject: string;
    body: string;
    pdfFilename: string;
    pdf: ArrayBuffer;
  }
): Promise<string> {
  const accessToken = await validAccessToken(env, organizationId);
  const response = await fetch(`${graphBaseUrl}/me/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      subject: input.subject,
      body: {
        contentType: "Text",
        content: input.body
      },
      toRecipients: [
        {
          emailAddress: {
            address: input.to
          }
        }
      ],
      attachments: [
        {
          "@odata.type": "#microsoft.graph.fileAttachment",
          name: input.pdfFilename,
          contentType: "application/pdf",
          contentBytes: arrayBufferToBase64(input.pdf)
        }
      ]
    })
  });

  if (!response.ok) throw new Error(`Microsoft Graph draft creation failed: ${response.status}`);

  const draft = await response.json<{ webLink?: string }>();
  if (!draft.webLink) throw new Error("Microsoft Graph did not return a draft link.");
  return draft.webLink;
}

async function validAccessToken(env: Env, organizationId: string): Promise<string> {
  const config = outlookConfig(env);
  if (!config.ok) throw new Error(config.error);

  const connection = await getOutlookConnection(env, organizationId);
  if (!connection) throw new Error("Outlook is not connected.");

  const expiresAt = new Date(connection.access_token_expires_at).getTime();
  if (expiresAt > Date.now() + 2 * 60 * 1000) {
    return decryptString(env, connection.access_token_ciphertext);
  }

  const refreshToken = await decryptString(env, connection.refresh_token_ciphertext);
  const token = await requestToken(env, {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: outlookScopes.join(" ")
  });

  await env.DB.prepare(
    `UPDATE outlook_connections
     SET access_token_ciphertext = ?, refresh_token_ciphertext = ?, access_token_expires_at = ?, updated_at = CURRENT_TIMESTAMP
     WHERE organization_id = ?`
  )
    .bind(
      await encryptString(env, token.access_token),
      await encryptString(env, token.refresh_token ?? refreshToken),
      tokenExpiresAt(token.expires_in ?? 3600),
      organizationId
    )
    .run();

  return token.access_token;
}

async function saveOutlookConnection(
  env: Env,
  context: AuthContext,
  token: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    accountEmail: string;
    displayName: string;
  }
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO outlook_connections (
       organization_id, user_id, account_email, display_name, access_token_ciphertext, refresh_token_ciphertext, access_token_expires_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(organization_id) DO UPDATE SET
       user_id = excluded.user_id,
       account_email = excluded.account_email,
       display_name = excluded.display_name,
       access_token_ciphertext = excluded.access_token_ciphertext,
       refresh_token_ciphertext = excluded.refresh_token_ciphertext,
       access_token_expires_at = excluded.access_token_expires_at,
       updated_at = CURRENT_TIMESTAMP`
  )
    .bind(
      context.organization.id,
      context.user.id,
      token.accountEmail,
      token.displayName,
      await encryptString(env, token.accessToken),
      await encryptString(env, token.refreshToken),
      tokenExpiresAt(token.expiresIn)
    )
    .run();
}

async function getOutlookConnection(env: Env, organizationId: string): Promise<OutlookConnectionRow | null> {
  return env.DB.prepare("SELECT * FROM outlook_connections WHERE organization_id = ?")
    .bind(organizationId)
    .first<OutlookConnectionRow>();
}

async function requestToken(env: Env, values: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch(`${microsoftBaseUrl(env)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(values).toString()
  });
  if (!response.ok) throw new Error(`Microsoft token request failed: ${response.status}`);
  return response.json<TokenResponse>();
}

async function graphGetMe(accessToken: string): Promise<{ displayName?: string; mail?: string; userPrincipalName?: string }> {
  const response = await fetch(`${graphBaseUrl}/me?$select=displayName,mail,userPrincipalName`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) throw new Error(`Microsoft profile request failed: ${response.status}`);
  return response.json<{ displayName?: string; mail?: string; userPrincipalName?: string }>();
}

function outlookConfig(env: Env): { ok: true; clientId: string; clientSecret: string } | { ok: false; error: string } {
  if (!env.MICROSOFT_CLIENT_ID || !env.MICROSOFT_CLIENT_SECRET || !env.OUTLOOK_TOKEN_SECRET) {
    return { ok: false, error: "Outlook is not configured. Add MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, and OUTLOOK_TOKEN_SECRET." };
  }
  return { ok: true, clientId: env.MICROSOFT_CLIENT_ID, clientSecret: env.MICROSOFT_CLIENT_SECRET };
}

function microsoftBaseUrl(env: Env): string {
  return `https://login.microsoftonline.com/${encodeURIComponent(env.MICROSOFT_TENANT || defaultTenant)}`;
}

function outlookRedirectUri(request: Request): string {
  return new URL("/settings/outlook/callback", request.url).toString();
}

function tokenExpiresAt(expiresInSeconds: number): string {
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
}

async function encryptString(env: Env, value: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await encryptionKey(env);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value));
  return `${arrayBufferToBase64(iv.buffer)}.${arrayBufferToBase64(encrypted)}`;
}

async function decryptString(env: Env, value: string): Promise<string> {
  const [ivBase64, encryptedBase64] = value.split(".");
  if (!ivBase64 || !encryptedBase64) throw new Error("Invalid encrypted Outlook token.");
  const key = await encryptionKey(env);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToArrayBuffer(ivBase64) },
    key,
    base64ToArrayBuffer(encryptedBase64)
  );
  return new TextDecoder().decode(decrypted);
}

async function encryptionKey(env: Env): Promise<CryptoKey> {
  if (!env.OUTLOOK_TOKEN_SECRET) throw new Error("OUTLOOK_TOKEN_SECRET is required.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(env.OUTLOOK_TOKEN_SECRET));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function arrayBufferToBase64(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function base64ToArrayBuffer(value: string): ArrayBuffer {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}
