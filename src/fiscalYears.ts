// Budget records use the fiscal year's ending year; keep those keys stable.
export function currentFiscalYear(startMonth: number, now = new Date()): number {
  return now.getUTCFullYear() + (startMonth > 1 && now.getUTCMonth() + 1 >= startMonth ? 1 : 0);
}

export function fiscalYearLabel(year: number, startMonth: number): string {
  return startMonth === 1 ? String(year) : `${year - 1}-${year}`;
}
