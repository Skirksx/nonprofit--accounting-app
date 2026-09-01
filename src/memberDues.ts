import { randomId } from "./crypto.ts";
import { rotaryLogoDataUrl } from "./reports.ts";
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

export type MemberDuesSettings = {
  id: string;
  organization_id: string;
  fiscal_year: string;
  quarterly_dues_cents: number;
  meal_cents: number;
  meeting_day: string;
};

export type MemberInvoice = {
  member: MemberDuesRecord;
  settings: MemberDuesSettings;
  lineItems: Array<{ description: string; amountCents: number }>;
  totalCents: number;
};

const invoiceSenderName = "Stephen Kirk";
const invoiceSenderEmail = "Sbkirk@outlook.com";

type PdfImage = {
  bytes: Uint8Array;
  width: number;
  height: number;
};

const DEFAULT_SETTINGS: Omit<MemberDuesSettings, "id" | "organization_id"> = {
  fiscal_year: "2026-2027",
  quarterly_dues_cents: 4000,
  meal_cents: 1100,
  meeting_day: "Tuesday"
};

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

export async function getMemberDuesSettings(env: Env, organizationId: string): Promise<MemberDuesSettings> {
  await seedMemberDuesSettingsIfEmpty(env, organizationId);
  const settings = await env.DB.prepare(
    `SELECT *
     FROM member_dues_settings
     WHERE organization_id = ?
     ORDER BY created_at DESC
     LIMIT 1`
  )
    .bind(organizationId)
    .first<MemberDuesSettings>();

  if (!settings) throw new Error("Member dues settings could not be loaded.");
  return settings;
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

export async function updateMemberDuesSettings(env: Env, organizationId: string, settings: Omit<MemberDuesSettings, "id" | "organization_id">): Promise<void> {
  const current = await getMemberDuesSettings(env, organizationId);
  await env.DB.prepare(
    `UPDATE member_dues_settings
     SET fiscal_year = ?,
       quarterly_dues_cents = ?,
       meal_cents = ?,
       meeting_day = ?,
       updated_at = CURRENT_TIMESTAMP
     WHERE organization_id = ? AND id = ?`
  )
    .bind(
      settings.fiscal_year,
      settings.quarterly_dues_cents,
      settings.meal_cents,
      settings.meeting_day,
      organizationId,
      current.id
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

export function parseMemberDuesSettings(form: FormData): Omit<MemberDuesSettings, "id" | "organization_id"> {
  return {
    fiscal_year: stringField(form, "fiscalYear") || DEFAULT_SETTINGS.fiscal_year,
    quarterly_dues_cents: moneyToCents(stringField(form, "quarterlyDues")) ?? DEFAULT_SETTINGS.quarterly_dues_cents,
    meal_cents: moneyToCents(stringField(form, "mealAmount")) ?? DEFAULT_SETTINGS.meal_cents,
    meeting_day: stringField(form, "meetingDay") || DEFAULT_SETTINGS.meeting_day
  };
}

export function memberDuesInvoice(member: MemberDuesRecord, settings: MemberDuesSettings): MemberInvoice {
  const duesCents = duesAmountCents(member.dues_frequency, settings);
  const mealsCents = member.invoice_included === "dues_and_meals" ? mealsAmountCents(member.dues_frequency, settings) : 0;
  const lineItems = [
    { description: `${frequencyLabel(member.dues_frequency)} member dues`, amountCents: duesCents },
    ...(mealsCents > 0 ? [{ description: `${frequencyLabel(member.dues_frequency)} meals at ${formatMoney(settings.meal_cents)} per ${settings.meeting_day} meeting`, amountCents: mealsCents }] : [])
  ];
  return {
    member,
    settings,
    lineItems,
    totalCents: lineItems.reduce((sum, item) => sum + item.amountCents, 0)
  };
}

export function createMemberDuesInvoicePdf(invoice: MemberInvoice, organizationName: string): ArrayBuffer {
  const rotaryLogo = pdfImageFromJpeg(rotaryLogoDataUrl().split(",")[1] ?? "", 198, 146);
  const clubName = invoiceOrganizationDisplayName(organizationName);
  const invoiceDate = formatInvoiceDate(new Date());
  const rows = invoiceDisplayRows(invoice);
  const stream = [
    pdfFillRect(0, 0, 612, 792, "1 1 1"),
    pdfFillRect(0, 770, 612, 6, "0.17 0.20 0.57"),
    pdfTextAt("Rotary", 42, 696, 42, "F2", "0.00 0.23 0.56"),
    pdfImageAt("Im1", 180, 666, 82, 60),
    pdfRightText("Invoice", 542, 710, 36, "F1", "0.17 0.20 0.57"),
    pdfCenteredText(clubName, 430, 678, 19, "F2", "0.00 0.32 0.60"),
    pdfCenteredText("PO Box 154", 430, 654, 12, "F1", "0.00 0.32 0.60"),
    pdfCenteredText("McConnelsville, Ohio 43756", 430, 636, 11, "F1", "0.00 0.32 0.60"),
    pdfTextAt(`Invoice Date: ${invoiceDate}`, 42, 568, 12, "F2", "0.00 0.32 0.60"),
    pdfTextAt("Invoice for", 42, 526, 14, "F2", "0.00 0.32 0.60"),
    pdfTextAt(invoice.member.member_name.split("\n")[0], 42, 506, 12, "F1", "0 0 0"),
    pdfTextAt("Payable to", 204, 526, 14, "F2", "0.00 0.32 0.60"),
    pdfTextAt(clubName, 204, 506, 12, "F1", "0 0 0"),
    pdfTextAt("Due date", 440, 526, 14, "F2", "0.00 0.32 0.60"),
    pdfTextAt("Upon Receipt", 440, 506, 12, "F1", "0 0 0"),
    pdfStrokeLine(40, 438, 500, 438, "0.70 0.70 0.70"),
    pdfTextAt("Description", 42, 404, 13, "F2", "0.17 0.20 0.57"),
    pdfRightText("Qty", 336, 404, 13, "F2", "0.17 0.20 0.57"),
    pdfRightText("Unit price", 424, 404, 13, "F2", "0.17 0.20 0.57"),
    pdfRightText("Total price", 500, 404, 13, "F2", "0.17 0.20 0.57")
  ];

  let y = 382;
  rows.forEach((item, index) => {
    stream.push(
      ...(index % 2 === 0 ? [pdfFillRect(40, y - 6, 460, 18, "0.94 0.94 0.94")] : []),
      pdfTextAt(item.description, 42, y, 11, "F1", "0 0 0"),
      pdfRightText("1", 336, y, 11, "F1", "0 0 0"),
      pdfRightText(formatMoney(item.amountCents), 424, y, 11, "F1", "0 0 0"),
      pdfRightText(formatMoney(item.amountCents), 500, y, 11, "F1", "0 0 0")
    );
    y -= 18;
    if (item.detail) {
      stream.push(pdfTextAt(item.detail, 86, y, 11, "F1", "0 0 0"));
      y -= 30;
    } else {
      y -= 18;
    }
  });

  stream.push(
    pdfFillRect(40, y - 2, 460, 18, "0.94 0.94 0.94"),
    pdfStrokeLine(40, y - 2, 500, y - 2, "0.70 0.70 0.70"),
    pdfTextAt("Notes:", 42, y - 28, 11, "F1", "0.25 0.25 0.25"),
    pdfStrokeLine(362, y - 2, 500, y - 2, "0.70 0.70 0.70"),
    pdfRightText("Subtotal", 424, y - 30, 12, "F1", "0.17 0.20 0.57"),
    pdfRightText(formatMoney(invoice.totalCents), 500, y - 30, 12, "F2", "0 0 0"),
    pdfRightText("Adjustments", 424, y - 52, 12, "F1", "0.17 0.20 0.57"),
    pdfRightText("$0.00", 500, y - 52, 12, "F2", "0.42 0.42 0.42"),
    pdfFillRect(340, y - 84, 160, 28, "1.00 0.84 0.38"),
    pdfRightText(formatMoney(invoice.totalCents), 496, y - 76, 20, "F2", "0.00 0.32 0.60")
  );

  return buildPdf(stream.join("\n"), rotaryLogo);
}

export function memberInvoiceEmailHref(invoice: MemberInvoice): string {
  const subject = `M&M Rotary Club dues invoice ${invoice.settings.fiscal_year}`;
  const body = [
    `Hello ${invoice.member.member_name.split("\n")[0]},`,
    "",
    `Attached is your M&M Rotary Club dues invoice for fiscal year ${invoice.settings.fiscal_year}.`,
    `Amount due: ${formatMoney(invoice.totalCents)}`,
    "",
    "Thank you,",
    invoiceSenderName
  ].join("\n");
  const params = new URLSearchParams({
    to: invoice.member.email,
    subject,
    body,
    login_hint: invoiceSenderEmail
  });
  return `https://outlook.office.com/mail/deeplink/compose?${params.toString()}`;
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

async function seedMemberDuesSettingsIfEmpty(env: Env, organizationId: string): Promise<void> {
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS setting_count FROM member_dues_settings WHERE organization_id = ?"
  )
    .bind(organizationId)
    .first<{ setting_count?: number; settingCount?: number }>();
  const count = row?.setting_count ?? row?.settingCount ?? 0;
  if (count > 0) return;

  await env.DB.prepare(
    `INSERT INTO member_dues_settings (
      id,
      organization_id,
      fiscal_year,
      quarterly_dues_cents,
      meal_cents,
      meeting_day
    ) VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(
      randomId("dues_settings"),
      organizationId,
      DEFAULT_SETTINGS.fiscal_year,
      DEFAULT_SETTINGS.quarterly_dues_cents,
      DEFAULT_SETTINGS.meal_cents,
      DEFAULT_SETTINGS.meeting_day
    )
    .run();
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

function duesAmountCents(value: DuesFrequency, settings: MemberDuesSettings): number {
  if (value === "quarterly") return settings.quarterly_dues_cents;
  if (value === "semi_annual") return settings.quarterly_dues_cents * 2;
  if (value === "annual") return settings.quarterly_dues_cents * 4;
  return 0;
}

function mealsAmountCents(value: DuesFrequency, settings: MemberDuesSettings): number {
  if (value === "quarterly") return settings.meal_cents * 13;
  if (value === "semi_annual") return settings.meal_cents * 26;
  if (value === "annual") return settings.meal_cents * 52;
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

function moneyToCents(value: string): number | null {
  const normalized = value.replaceAll("$", "").replaceAll(",", "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

function formatMoney(amountCents: number): string {
  return `$${(amountCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function invoiceDisplayRows(invoice: MemberInvoice): Array<{ description: string; detail: string; amountCents: number }> {
  const fiscalYear = invoice.settings.fiscal_year.replace("2026-2027", "2026-27");
  const duesItem = invoice.lineItems.find((item) => /member dues/i.test(item.description));
  const otherItems = invoice.lineItems.filter((item) => !/member dues/i.test(item.description));
  const rows: Array<{ description: string; detail: string; amountCents: number }> = [];

  if (duesItem && invoice.member.dues_frequency === "annual") {
    for (let quarter = 1; quarter <= 4; quarter += 1) {
      rows.push({
        description: "Member Dues",
        detail: `Quarter ${quarter} - FY ${fiscalYear}`,
        amountCents: invoice.settings.quarterly_dues_cents
      });
    }
  } else if (duesItem && invoice.member.dues_frequency === "semi_annual") {
    for (let half = 1; half <= 2; half += 1) {
      rows.push({
        description: "Member Dues",
        detail: half === 1 ? `Quarters 1-2 - FY ${fiscalYear}` : `Quarters 3-4 - FY ${fiscalYear}`,
        amountCents: invoice.settings.quarterly_dues_cents * 2
      });
    }
  } else if (duesItem) {
    rows.push({
      description: "Member Dues",
      detail: `Quarter 1 - FY ${fiscalYear}`,
      amountCents: duesItem.amountCents
    });
  }

  otherItems.forEach((item) => rows.push({ description: item.description, detail: "", amountCents: item.amountCents }));
  return rows.length ? rows : invoice.lineItems.map((item) => ({ ...item, detail: "" }));
}

function invoiceOrganizationDisplayName(organizationName: string): string {
  return organizationName.replaceAll(" & ", " ").replace(/\s+Club$/i, "").trim() || organizationName;
}

function formatInvoiceDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

function buildPdf(stream: string, image?: PdfImage): ArrayBuffer {
  const imageObject = image
    ? [
        binaryObject(
          `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.byteLength} >>`,
          image.bytes
        )
      ]
    : [];
  const imageResource = image ? " /XObject << /Im1 8 0 R >>" : "";
  const objects = [
    textBytes("<< /Type /Catalog /Pages 2 0 R >>"),
    textBytes("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    textBytes(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >>${imageResource} >> /Contents 7 0 R >>`),
    textBytes("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"),
    textBytes("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"),
    textBytes("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>"),
    binaryObject(`<< /Length ${textBytes(stream).byteLength} >>`, textBytes(stream)),
    ...imageObject
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

function pdfCenteredText(value: string, centerX: number, y: number, size: number, font: string, color: string): string {
  return pdfTextAt(value, centerX - value.length * size * 0.27, y, size, font, color);
}

function pdfImageAt(name: string, x: number, y: number, width: number, height: number): string {
  return `q ${width} 0 0 ${height} ${x} ${y} cm /${name} Do Q`;
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

function pdfImageFromJpeg(base64: string, width: number, height: number): PdfImage {
  return { bytes: base64Bytes(base64), width, height };
}

function base64Bytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
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
