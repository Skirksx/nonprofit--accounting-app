import assert from "node:assert/strict";
import test from "node:test";

import {
  createMemberDuesInvoicePdf,
  memberInvoiceEmailHref,
  memberDuesInvoice,
  parseMemberDuesSettings,
  parseMemberDuesUpdate,
  type MemberDuesRecord,
  type MemberDuesSettings
} from "../src/memberDues.ts";

test("parses member dues spreadsheet updates", () => {
  const form = new FormData();
  form.set("id", "dues_1");
  form.set("memberName", "Kirk, Stephen");
  form.set("email", "sbirk@example.com");
  form.set("address", "4515 State Route 669 NW");
  form.set("duesFrequency", "quarterly");
  form.set("invoiceIncluded", "dues_and_meals");
  form.set("q1Paid", "on");
  form.set("notes", "Invoice by email");

  const result = parseMemberDuesUpdate(form);

  assert.equal(result.member_name, "Kirk, Stephen");
  assert.equal(result.dues_frequency, "quarterly");
  assert.equal(result.invoice_included, "dues_and_meals");
  assert.equal(result.q1_paid, 1);
  assert.equal(result.q2_paid, 0);
});

test("parses member dues fiscal year settings", () => {
  const form = new FormData();
  form.set("fiscalYear", "2026-2027");
  form.set("quarterlyDues", "40.00");
  form.set("mealAmount", "11.00");
  form.set("meetingDay", "Tuesday");

  const result = parseMemberDuesSettings(form);

  assert.equal(result.fiscal_year, "2026-2027");
  assert.equal(result.quarterly_dues_cents, 4000);
  assert.equal(result.meal_cents, 1100);
  assert.equal(result.meeting_day, "Tuesday");
});

test("creates member dues invoice PDF", () => {
  const member: MemberDuesRecord = {
    id: "dues_1",
    organization_id: "org_1",
    member_name: "Kirk, Stephen\nEdward Jones",
    email: "sbirk@example.com",
    address: "4515 State Route 669 NW\nMcConnelsville, OH 43756",
    dues_frequency: "quarterly",
    invoice_included: "dues_and_meals",
    q1_paid: 0,
    q2_paid: 0,
    q3_paid: 0,
    q4_paid: 0,
    notes: ""
  };

  const settings: MemberDuesSettings = {
    id: "settings_1",
    organization_id: "org_1",
    fiscal_year: "2026-2027",
    quarterly_dues_cents: 4000,
    meal_cents: 1100,
    meeting_day: "Tuesday"
  };

  const invoice = memberDuesInvoice(member, settings);
  const pdf = Buffer.from(createMemberDuesInvoicePdf(invoice, "Malta & McConnelsville Rotary Club"));
  const text = new TextDecoder().decode(pdf);

  assert.equal(invoice.totalCents, 18300);
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
  assert.match(text, /Invoice/);
  assert.match(text, /Member Dues/);
  assert.match(text, /Quarter 1 - FY 2026-27/);
  assert.match(text, /Quarterly meals at \$11.00 per Tuesday meeting/);
});

test("opens member dues invoice draft in Stephen Kirk Outlook", () => {
  const member: MemberDuesRecord = {
    id: "dues_1",
    organization_id: "org_1",
    member_name: "Bell, Meranda K",
    email: "meranda@example.com",
    address: "",
    dues_frequency: "quarterly",
    invoice_included: "dues_only",
    q1_paid: 0,
    q2_paid: 0,
    q3_paid: 0,
    q4_paid: 0,
    notes: ""
  };
  const settings: MemberDuesSettings = {
    id: "settings_1",
    organization_id: "org_1",
    fiscal_year: "2026-2027",
    quarterly_dues_cents: 4000,
    meal_cents: 1100,
    meeting_day: "Tuesday"
  };

  const href = memberInvoiceEmailHref(memberDuesInvoice(member, settings));
  const url = new URL(href);

  assert.equal(url.protocol, "ms-outlook:");
  assert.equal(url.host, "compose");
  assert.equal(url.searchParams.get("to"), "meranda@example.com");
  assert.match(url.searchParams.get("body") ?? "", /Stephen Kirk/);
});
