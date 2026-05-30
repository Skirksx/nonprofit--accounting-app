import assert from "node:assert/strict";
import test from "node:test";

import type { AuthContext, OrganizationProfile } from "../src/types.ts";
import { validateSetup } from "../src/validation.ts";
import { dashboardPage } from "../src/views.ts";

test("validates setup with a church organization profile", () => {
  const form = setupForm("church");

  const result = validateSetup(form);

  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.organizationProfile, "church");
});

test("rejects unknown organization profiles", () => {
  const form = setupForm("business");

  const result = validateSetup(form);

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.errors.organizationProfile, "Choose church or Rotary.");
});

test("shows church dashboard payroll options", async () => {
  const page = dashboardPage("Test Ledger", authContext("church"), {
    accountCount: 5,
    activeAccountCount: 4
  });

  const html = await page.text();

  assert.match(html, /Church accounting dashboard/);
  assert.match(html, /href="\/payroll"/);
});

test("hides payroll from Rotary dashboard and navigation", async () => {
  const page = dashboardPage("Test Ledger", authContext("rotary"), {
    accountCount: 5,
    activeAccountCount: 4
  });

  const html = await page.text();

  assert.match(html, /Rotary accounting dashboard/);
  assert.doesNotMatch(html, /href="\/payroll"/);
  assert.match(html, /Dues and event income/);
});

function setupForm(profile: string): FormData {
  const form = new FormData();
  form.set("organizationName", "Community Church");
  form.set("organizationProfile", profile);
  form.set("fiscalYearStartMonth", "1");
  form.set("name", "Staci Kirk");
  form.set("email", "staci@example.org");
  form.set("password", "secure-password-123");
  return form;
}

function authContext(profile: OrganizationProfile): AuthContext {
  return {
    user: {
      id: "usr_1",
      email: "staci@example.org",
      name: "Staci Kirk"
    },
    organization: {
      id: "org_1",
      name: profile === "church" ? "Community Church" : "Rotary Club",
      fiscal_year_start_month: 1,
      base_currency: "USD",
      organization_profile: profile,
      logo_data_url: null
    },
    role: "owner",
    csrfToken: "csrf_1"
  };
}
