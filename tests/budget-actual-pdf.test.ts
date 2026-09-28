import assert from 'node:assert/strict';
import test from 'node:test';
import { createBudgetVsActualReportPdf, type BudgetVsActualReport } from '../src/reports.ts';
import { budgetVsActualPage } from '../src/views.ts';
import type { AuthContext } from '../src/types.ts';

export function sampleReport(count = 2, hasBudgetLines = true): BudgetVsActualReport {
  return { filters: {organizationId:'org', fiscalYear:2027, startDate:'2026-08-01', endDate:'2026-09-30', fundId:'fund-a'}, hasBudgetLines,
    rows: Array.from({length:count},(_,i)=>({account_id:String(i),account_number:String(4000+i),account_name:`Example account ${i}`,account_type:i%2?'expense':'revenue',budget_cents:10000,actual_cents:12500,variance_cents:2500})),
    totalBudgetCents:count*10000,totalActualCents:count*12500,totalVarianceCents:count*2500};
}

test('PDF includes both sections, applied filters, totals and matching report branding',()=>{
  const pdf=Buffer.from(createBudgetVsActualReportPdf(sampleReport(),'Example Rotary',7,'Projects')).toString('latin1');
  for(const value of ['BUDGET VS ACTUAL','2026-2027','2026-08-01 to 2026-09-30','Fund: Projects','TOTAL INCOME','TOTAL EXPENSES','$100.00','$125.00','$25.00','Service Above Self']) assert.ok(pdf.includes(value),value);
  assert.match(pdf,/\/Count 1/);
});

test('PDF repeats headers and keeps every row and subtotal on printable pages',()=>{
  const pdf=Buffer.from(createBudgetVsActualReportPdf(sampleReport(120),'Example Rotary',7)).toString('latin1');
  assert.ok(Number(pdf.match(/\/Count (\d+)/)?.[1])>1);
  for(let i=0;i<120;i++) assert.ok(pdf.includes(`(Example account ${i})`));
  assert.equal((pdf.match(/\(TOTAL INCOME\)/g)||[]).length,1);
  assert.equal((pdf.match(/\(TOTAL EXPENSES\)/g)||[]).length,1);
  for(const m of pdf.matchAll(/1 0 0 1 [\d.]+ (-?[\d.]+) Tm/g)) assert.ok(Number(m[1])>=36,`clipped text at ${m[1]}`);
});

test('missing budgets remain unavailable and empty sections remain printable',()=>{
  const pdf=Buffer.from(createBudgetVsActualReportPdf(sampleReport(0,false),'Example Rotary',1)).toString('latin1');
  assert.ok(pdf.includes('Fiscal year 2027'));
  assert.ok(pdf.includes('No budget entered'));
  assert.ok(pdf.includes('Not entered'));
  assert.ok(pdf.includes('TOTAL INCOME'));
  assert.ok(pdf.includes('TOTAL EXPENSES'));
});

test('Print PDF link exports the displayed filters rather than unsaved form edits',async()=>{
  const context={user:{id:'u',name:'Test',email:'test@example.test'},organization:{id:'org',name:'Example Rotary',fiscal_year_start_month:7,base_currency:'USD',organization_profile:'rotary',logo_data_url:null},role:'owner',csrfToken:'test',sessionId:'test'} as AuthContext;
  const html=await budgetVsActualPage('Ledger',context,[],[],sampleReport()).text();
  assert.match(html,/budget-vs-actual.pdf\?fiscalYear=2027&amp;startDate=2026-08-01&amp;endDate=2026-09-30&amp;fundId=fund-a/);
  const invalid=await budgetVsActualPage('Ledger',context,[],[],null,{fiscalYear:'Invalid'}).text();
  assert.ok(!invalid.includes('budget-vs-actual.pdf'));
});
