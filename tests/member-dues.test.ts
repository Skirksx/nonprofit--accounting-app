import assert from "node:assert/strict";
import test from "node:test";

import {
  createMemberDuesInvoicePdf,
  memberDuesInvoice,
  parseMemberDuesUpdate,
  type MemberDuesRecord
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

  const invoice = memberDuesInvoice(member);
  const pdf = Buffer.from(createMemberDuesInvoicePdf(invoice, "Malta & McConnelsville Rotary Club"));
  const text = new TextDecoder().decode(pdf);

  assert.equal(invoice.totalCents, 10000);
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
  assert.match(text, /Member Dues Invoice/);
  assert.match(text, /Quarterly member dues/);
  assert.match(text, /Quarterly meals/);
});
