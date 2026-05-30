import { hashPassword, verifyPassword } from "./crypto.ts";
import type { Env, OrganizationProfile } from "./types.ts";
import type { ValidationResult } from "./validation.ts";

const MAX_LOGO_BYTES = 1_500_000;
const LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export function validateProfileName(form: FormData): ValidationResult<{ name: string }> {
  const name = stringValue(form, "name");
  const errors: Record<string, string> = {};

  if (name.length < 2) errors.name = "Name must be at least 2 characters.";
  if (name.length > 120) errors.name = "Name must be 120 characters or fewer.";

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, data: { name } };
}

export function validatePasswordFields(form: FormData): ValidationResult<{
  currentPassword: string;
  newPassword: string;
}> {
  const currentPassword = stringValue(form, "currentPassword");
  const newPassword = stringValue(form, "newPassword");
  const confirmPassword = stringValue(form, "confirmPassword");
  const errors: Record<string, string> = {};

  if (currentPassword.length === 0) errors.currentPassword = "Current password is required.";
  if (newPassword.length < 12) errors.newPassword = "Use at least 12 characters.";
  if (newPassword !== confirmPassword) errors.confirmPassword = "Passwords do not match.";

  return Object.keys(errors).length > 0
    ? { ok: false, errors }
    : { ok: true, data: { currentPassword, newPassword } };
}

export function validateOrganizationProfile(form: FormData): ValidationResult<{ organizationProfile: OrganizationProfile }> {
  const organizationProfile = stringValue(form, "organizationProfile") as OrganizationProfile;
  if (!["church", "rotary"].includes(organizationProfile)) {
    return { ok: false, errors: { organizationProfile: "Choose church or Rotary." } };
  }

  return { ok: true, data: { organizationProfile } };
}

export async function updateUserName(env: Env, userId: string, name: string): Promise<void> {
  await env.DB.prepare("UPDATE users SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(name, userId)
    .run();
}

export async function updateUserPassword(
  env: Env,
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<ValidationResult<null>> {
  const user = await env.DB.prepare(
    "SELECT password_hash, password_salt, password_iterations FROM users WHERE id = ?"
  )
    .bind(userId)
    .first<{
      password_hash: string;
      password_salt: string;
      password_iterations: number;
    }>();

  if (!user) return { ok: false, errors: { currentPassword: "User was not found." } };

  const matches = await verifyPassword(
    currentPassword,
    user.password_hash,
    user.password_salt,
    user.password_iterations
  );
  if (!matches) return { ok: false, errors: { currentPassword: "Current password is incorrect." } };

  const password = await hashPassword(newPassword);
  await env.DB.prepare(
    `UPDATE users
     SET password_hash = ?, password_salt = ?, password_iterations = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`
  )
    .bind(password.hash, password.salt, password.iterations, userId)
    .run();

  return { ok: true, data: null };
}

export async function updateOrganizationProfile(
  env: Env,
  organizationId: string,
  organizationProfile: OrganizationProfile
): Promise<void> {
  await env.DB.prepare(
    "UPDATE organizations SET organization_profile = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  )
    .bind(organizationProfile, organizationId)
    .run();
}

export async function logoFileToDataUrl(file: File): Promise<ValidationResult<{ logoDataUrl: string }>> {
  const errors: Record<string, string> = {};

  if (file.size === 0) errors.logo = "Choose an image file.";
  if (file.size > MAX_LOGO_BYTES) errors.logo = "Logo must be 1.5 MB or smaller.";
  if (!LOGO_TYPES.has(file.type)) errors.logo = "Logo must be PNG, JPG, WEBP, or GIF.";
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const bytes = new Uint8Array(await file.arrayBuffer());
  return {
    ok: true,
    data: {
      logoDataUrl: `data:${file.type};base64,${toBase64(bytes)}`
    }
  };
}

export async function updateOrganizationLogo(
  env: Env,
  organizationId: string,
  logoDataUrl: string
): Promise<void> {
  await env.DB.prepare(
    "UPDATE organizations SET logo_data_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  )
    .bind(logoDataUrl, organizationId)
    .run();
}

function stringValue(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
