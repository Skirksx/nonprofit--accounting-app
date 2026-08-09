import { randomId } from "./crypto.ts";
import type { Env } from "./types.ts";

export type DuesFrequency = "annual" | "semi_annual" | "quarterly" | "";
export type InvoiceIncluded = "dues_only" | "dues_and_meals" | "";

export type MemberDuesRecord = {
  id: string;
  organization_id: string;
  member_name: string;
  email: string;
  address: string;
  dues_frequency: DuesFrequency;
  invoice_included: InvoiceIncluded;
  q1_paid: number;
  q2_paid: number;
  q3_paid: number;
  q4_paid: number;
  notes: string;
};

export type MemberDuesUpdate = Omit<MemberDuesRecord, "organization_id">;

export type MemberInvoice = {
  member: MemberDuesRecord;
  fiscalYear: string;
  lineItems: Array<{ description: string; amountCents: number }>;
  totalCents: number;
};

const FISCAL_YEAR = "2026-2027";

const seedMembers: Array<Omit<MemberDuesRecord, "id" | "organization_id">> = [
  member("Bates, Trish", "tbates@highlandoakshc.com", "4114 Highway 376\nMcConnelsville, OH 43756", "annual", "dues_only"),
  member("Bell, Meranda K", "arrowscounselingcenter@gmail.com", "1510 Riverview Road\nMalta, OH 43758", "annual", "dues_only"),
  member("Coler, John\nShrivers Pharmacy", "jcoler820@gmail.com", "PO Box 8\nZanesville, Ohio 43702", "annual", "dues_and_meals", [1, 1, 0, 0], "Q3 2025-26 through Q2 2026-27 paid via check deposited 1/22/26"),
  member("Doner, Max", "", "", "", "", [1, 1, 1, 0]),
  member("Donner, Meriam H", "", "", "", "", [1, 1, 1, 0]),
  member("Flesher, William H.", "whflesher@gmail.com", "PO Box 536\nMcConnelsville, OH 43756", "annual", "dues_only"),
  member("Fouts, Susan", "sfouts@gmail.com", "380 E McConnel Avenue\nMcConnelsville, OH 43756", "annual", "dues_only"),
  member("Gorrell, Wendy Powell\nMCBDD", "wgorrell@morgandd.org", "155 East Main Street\nMcConnelsville, OH 43756", "semi_annual", "dues_and_meals", [0, 0, 0, 0], "Wants invoiced annually for 2026-2027 fiscal year - invoice sent via email 2/17; includes Q3-4 and Q1-4 of next year"),
  member("Greismyer, Sarah\nMyers Specialty Market", "sarah.greismyer@gmail.com", "83 East Main Street\nMcConnelsville, OH 43756", "annual", "dues_only"),
  member("Hoskinson, James", "jhoskinson@langmasonry.com", "415 Brown Road\nMcConnelsville, OH 43756", "annual", "dues_only"),
  member("Kirk, Stephen\nEdward Jones", "Sbirk@outlook.com", "4515 State Route 669 NW\nMcConnelsville, OH 43756", "quarterly", "dues_and_meals"),
  member("Kirkbride, Dixie Lee", "dixie7162005@gmail.com", "PO Box 473\nStockport, OH 43787", "quarterly", "dues_only", [1, 0, 0, 0]),
  member("Louis, Tim\nMcConnelsville Village", "tlouis@vomcc.com", "9 West Main Street\nMcConnelsville, Ohio 43756", "annual", "dues_and_meals", [0, 0, 0, 0], "Billing Contact - Rita Murphy\nrmurphy@vomcc.com"),
  member("Maxwell, Heidi", "maxwells.heidi@gmail.com", "170 West Main Street\nMcConnelsville, OH 43756", "annual", "dues_only"),
  member("Mayle, Kathy\nBuckeye Hospice", "kmayle@continuinghc.com", "3652 North State Route 60\nMcConnelsville, OH 43756", "quarterly", "dues_and_meals"),
  member("Meadows, Cameron\nFirst National Bank", "cmeadows0422@gmail.com", "1840 East Airport Road\nMcConnelsville, OH 43756", "annual", "dues_only"),
  member("Murray, Carissa\nMiba", "carissa.murray@mahle.com", "5130 St. Rt 60\nMcConnelsville, OH 43756", "annual", "dues_only"),
  member("Newburn, Jessica\nContinuing Healthcare Solutions", "jnewburn@continuinghc.com", "856 South Riverside Drive\nMcConnelsville, OH 43756", "quarterly", "dues_only"),
  member("Patrick, Richard Douglas", "doug.patrick@embarqmail.com", "165 South Tenth Street\nMcConnelsville, OH 43756", "quarterly", "dues_only", [1, 1, 0, 0], "Q1 and Q2 dues received 6/30/26"),
  member("Penrose, Chris", "chrispenrose1961@gmail.com", "1165 South Bald Eagle Road\nStockport, OH 43787", "quarterly", "dues_only", [1, 0, 0, 0]),
  member("Penrose, Jordan", "penrose.30@osu.edu", "155 East Main Street\nMcConnelsville, OH 43756", "annual", "dues_only"),
  member("Sheets, Linda", "Linda.sheets5050@gmail.com", "101 South Elliott Road\nMalta, OH 43758", "annual", "dues_only"),
  member("Shockley, Rebecca A\nNorth Valley Bank", "bshockley@nvboh.bank", "4430 State Route 676\nStockport, OH 43787", "annual", "dues_and_meals"),
  member("Smedley, Kathy J", "ksmedley@interim-health.com", "1375 Buckeye Ridge Road\nChesterhill, OH 43728", "annual", "dues_only"),
  member("Smith, James", "smittysglassblock@gmail.com", "9265 North River Road\nMcConnelsville, OH 43756", "quarterly", "dues_only"),
  member("VanHorn, Timothy", "vanlimousin@hotmail.com", "397 Pascal Road\nMalta, OH 43758", "annual", "dues_only"),
  member("Weaver, Pam\nMorgan County Sheriffs Office", "p13weaver@gmail.com", "37 East Main Street\nMcConnelsville, Ohio 43756", "quarterly", "dues_only"),
  member("Wickham, Cara\nShrivers Hospice", "cwickham@shrivershospice.com", "PO Box 8\nZanesville, OH 43702", "annual", "dues_and_meals", [1, 1, 0, 0], "Q3 2025-26 through Q2 2026-27 paid via check deposited 1/22/26")
];

export async function listMemberDues(env: Env, organizationId: string): Promise<MemberDuesRecord[]> {
  await seedMemberDuesIfEmpty(env, organizationId);
  const result = await env.DB.prepare(
    `SELECT *
     FROM member_dues_members
     WHERE organization_id = ?
     ORDER BY member_name ASC`
  )
    .bind(organizationId)
    .all<MemberDuesRecord>();

  return result.results ?? [];
}

export async function getMemberDuesRecord(env: Env, organizationId: string, id: string): Promise<MemberDuesRecord | null> {
  await seedMemberDuesIfEmpty(env, organizationId);
  return env.DB.prepare(
    `SELECT *
     FROM member_dues_members
     WHERE organization_id = ? AND id = ?`
  )
    .bind(organizationId, id)
    .first<MemberDuesRecord>();
}

export async function updateMemberDuesRecord(env: Env, organizationId: string, data: MemberDuesUpdate): Promise<void> {
  await env.DB.prepare(
    `UPDATE member_dues_members
     SET member_name = ?,
       email = ?,
       address = ?,
       dues_frequency = ?,
       invoice_included = ?,
       q1_paid = ?,
       q2_paid = ?,
       q3_paid = ?,
       q4_paid = ?,
       notes = ?,
       updated_at = CURRENT_TIMESTAMP
     WHERE organization_id = ? AND id = ?`
  )
    .bind(
      data.member_name,
      data.email,
      data.address,
      data.dues_frequency,
      data.invoice_included,
      data.q1_paid,
      data.q2_paid,
      data.q3_paid,
      data.q4_paid,
      data.notes,
      organizationId,
      data.id
    )
    .run();
}

export function parseMemberDuesUpdate(form: FormData): MemberDuesUpdate {
  return {
    id: stringField(form, "id"),
    member_name: stringField(form, "memberName"),
    email: stringField(form, "email"),
    address: stringField(form, "address"),
    dues_frequency: duesFrequencyField(form, "duesFrequency"),
    invoice_included: invoiceIncludedField(form, "invoiceIncluded"),
    q1_paid: checkedField(form, "q1Paid"),
    q2_paid: checkedField(form, "q2Paid"),
    q3_paid: checkedField(form, "q3Paid"),
    q4_paid: checkedField(form, "q4Paid"),
    notes: stringField(form, "notes")
  };
}

export function memberDuesInvoice(member: MemberDuesRecord): MemberInvoice {
  const duesCents = duesAmountCents(member.dues_frequency);
  const mealsCents = member.invoice_included === "dues_and_meals" ? mealsAmountCents(member.dues_frequency) : 0;
  const lineItems = [
    { description: `${frequencyLabel(member.dues_frequency)} member dues`, amountCents: duesCents },
    ...(mealsCents > 0 ? [{ description: `${frequencyLabel(member.dues_frequency)} meals`, amountCents: mealsCents }] : [])
  ];
  return {
    member,
    fiscalYear: FISCAL_YEAR,
    lineItems,
    totalCents: lineItems.reduce((sum, item) => sum + item.amountCents, 0)
  };
}

export function createMemberDuesInvoicePdf(invoice: MemberInvoice, organizationName: string): ArrayBuffer {
  const stream = [
    pdfFillRect(0, 0, 612, 792, "1 1 1"),
    pdfStrokeRect(42, 44, 528, 704, "0.09 0.27 0.56", 2),
    pdfFillRect(42, 656, 528, 92, "0.09 0.27 0.56"),
    pdfTextAt(organizationName, 72, 706, 18, "F2", "1 1 1"),
    pdfTextAt("Member Dues Invoice", 72, 676, 28, "F2", "1 1 1"),
    pdfTextAt(`Fiscal year ${invoice.fiscalYear}`, 72, 640, 11, "F1", "0.09 0.27 0.56"),
    pdfTextAt("Bill to", 72, 596, 12, "F2", "0.09 0.27 0.56"),
    ...addressLines(invoice.member).flatMap((line, index) => [
      pdfTextAt(line, 72, 576 - index * 16, 11, index === 0 ? "F2" : "F1", "0.10 0.12 0.14")
    ]),
    pdfTextAt("Description", 72, 446, 10, "F2", "0.09 0.27 0.56"),
    pdfTextAt("Amount", 468, 446, 10, "F2", "0.09 0.27 0.56"),
    pdfStrokeLine(72, 432, 540, 432, "0.78 0.86 0.94")
  ];

  let y = 406;
  for (const item of invoice.lineItems) {
    stream.push(
      pdfTextAt(item.description, 72, y, 11, "F1", "0.10 0.12 0.14"),
      pdfRightText(formatMoney(item.amountCents), 540, y, 11, "F1", "0.10 0.12 0.14")
    );
    y -= 24;
  }

  stream.push(
    pdfStrokeLine(360, y - 2, 540, y - 2, "0.09 0.27 0.56"),
    pdfTextAt("Total due", 360, y - 28, 14, "F2", "0.09 0.27 0.56"),
    pdfRightText(formatMoney(invoice.totalCents), 540, y - 28, 14, "F2", "0.09 0.27 0.56"),
    pdfTextAt("Please remit payment to Malta & McConnelsville Rotary Club.", 72, 148, 10, "F1", "0.35 0.40 0.37"),
    pdfTextAt("Thank you for supporting Rotary service projects.", 72, 128, 10, "F3", "0.35 0.40 0.37")
  );

  return buildPdf(stream.join("\n"));
}

export function memberInvoiceEmailHref(invoice: MemberInvoice): string {
  const subject = `M&M Rotary Club dues invoice ${invoice.fiscalYear}`;
  const body = [
    `Hello ${invoice.member.member_name.split("\n")[0]},`,
    "",
    `Attached is your M&M Rotary Club dues invoice for fiscal year ${invoice.fiscalYear}.`,
    `Amount due: ${formatMoney(invoice.totalCents)}`,
    "",
    "Thank you,"
  ].join("\n");
  return `mailto:${encodeURIComponent(invoice.member.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function frequencyLabel(value: DuesFrequency): string {
  if (value === "semi_annual") return "Semi-annual";
  if (value === "quarterly") return "Quarterly";
  if (value === "annual") return "Annual";
  return "Unspecified";
}

export function invoiceIncludedLabel(value: InvoiceIncluded): string {
  if (value === "dues_and_meals") return "Dues and Meals";
  if (value === "dues_only") return "Dues Only";
  return "";
}

async function seedMemberDuesIfEmpty(env: Env, organizationId: string): Promise<void> {
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS member_count FROM member_dues_members WHERE organization_id = ?"
  )
    .bind(organizationId)
    .first<{ member_count?: number; memberCount?: number }>();
  const count = row?.member_count ?? row?.memberCount ?? 0;
  if (count > 0) return;

  await env.DB.batch(
    seedMembers.map((item) =>
      env.DB.prepare(
        `INSERT INTO member_dues_members (
          id,
          organization_id,
          member_name,
          email,
          address,
          dues_frequency,
          invoice_included,
          q1_paid,
          q2_paid,
          q3_paid,
          q4_paid,
          notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        randomId("dues"),
        organizationId,
        item.member_name,
        item.email,
        item.address,
        item.dues_frequency,
        item.invoice_included,
        item.q1_paid,
        item.q2_paid,
        item.q3_paid,
        item.q4_paid,
        item.notes
      )
    )
  );
}

function member(
  member_name: string,
  email: string,
  address: string,
  dues_frequency: DuesFrequency,
  invoice_included: InvoiceIncluded,
  paid: [number, number, number, number] = [0, 0, 0, 0],
  notes = ""
): Omit<MemberDuesRecord, "id" | "organization_id"> {
  return {
    member_name,
    email,
    address,
    dues_frequency,
    invoice_included,
    q1_paid: paid[0],
    q2_paid: paid[1],
    q3_paid: paid[2],
    q4_paid: paid[3],
    notes
  };
}

function duesAmountCents(value: DuesFrequency): number {
  if (value === "quarterly") return 4000;
  if (value === "semi_annual") return 8000;
  if (value === "annual") return 16000;
  return 0;
}

function mealsAmountCents(value: DuesFrequency): number {
  if (value === "quarterly") return 6000;
  if (value === "semi_annual") return 12000;
  if (value === "annual") return 24000;
  return 0;
}

function addressLines(member: MemberDuesRecord): string[] {
  return [member.member_name, member.address, member.email].join("\n").split("\n").filter(Boolean).slice(0, 7);
}

function stringField(form: FormData, name: string): string {
  return String(form.get(name) ?? "").trim();
}

function duesFrequencyField(form: FormData, name: string): DuesFrequency {
  const value = stringField(form, name);
  return value === "annual" || value === "semi_annual" || value === "quarterly" ? value : "";
}

function invoiceIncludedField(form: FormData, name: string): InvoiceIncluded {
  const value = stringField(form, name);
  return value === "dues_only" || value === "dues_and_meals" ? value : "";
}

function checkedField(form: FormData, name: string): number {
  return form.get(name) === "on" ? 1 : 0;
}

function formatMoney(amountCents: number): string {
  return `$${(amountCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function buildPdf(stream: string): ArrayBuffer {
  const objects = [
    textBytes("<< /Type /Catalog /Pages 2 0 R >>"),
    textBytes("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    textBytes("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >> /Contents 7 0 R >>"),
    textBytes("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"),
    textBytes("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"),
    textBytes("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>"),
    binaryObject(`<< /Length ${textBytes(stream).byteLength} >>`, textBytes(stream))
  ];
  let pdf = textBytes("%PDF-1.4\n");
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(pdf.byteLength);
    pdf = concatBytes(pdf, textBytes(`${index + 1} 0 obj\n`), objects[index], textBytes("\nendobj\n"));
  }
  const xrefOffset = pdf.byteLength;
  const xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  pdf = concatBytes(pdf, textBytes(xref));
  const buffer = new ArrayBuffer(pdf.byteLength);
  new Uint8Array(buffer).set(pdf);
  return buffer;
}

function pdfTextAt(value: string, x: number, y: number, size: number, font: string, color: string): string {
  return `BT ${color} rg /${font} ${size} Tf ${x} ${y} Td (${escapePdf(value)}) Tj ET`;
}

function pdfRightText(value: string, x: number, y: number, size: number, font: string, color: string): string {
  return pdfTextAt(value, x - value.length * size * 0.54, y, size, font, color);
}

function pdfFillRect(x: number, y: number, width: number, height: number, color: string): string {
  return `q ${color} rg ${x} ${y} ${width} ${height} re f Q`;
}

function pdfStrokeRect(x: number, y: number, width: number, height: number, color: string, lineWidth = 1): string {
  return `q ${color} RG ${lineWidth} w ${x} ${y} ${width} ${height} re S Q`;
}

function pdfStrokeLine(x1: number, y1: number, x2: number, y2: number, color: string): string {
  return `q ${color} RG 1 w ${x1} ${y1} m ${x2} ${y2} l S Q`;
}

function escapePdf(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)").replaceAll("\n", " ");
}

function textBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function binaryObject(dictionary: string, bytes: Uint8Array): Uint8Array {
  return concatBytes(textBytes(`${dictionary}\nstream\n`), bytes, textBytes("\nendstream"));
}

function concatBytes(...chunks: Uint8Array[]): Uint8Array {
  const length = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}
