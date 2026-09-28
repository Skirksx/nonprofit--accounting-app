// Budget records use the fiscal year's ending year; keep those keys stable.
export function currentFiscalYear(startMonth: number, now = new Date()): number {
  return now.getUTCFullYear() + (startMonth > 1 && now.getUTCMonth() + 1 >= startMonth ? 1 : 0);
}

export function fiscalYearLabel(year: number, startMonth: number): string {
  return startMonth === 1 ? String(year) : `${year - 1}-${year}`;
}

export function fiscalYearDates(year: number, startMonth: number): { startDate: string; endDate: string } {
  const startYear = startMonth === 1 ? year : year - 1;
  return {
    startDate: new Date(Date.UTC(startYear, startMonth - 1, 1)).toISOString().slice(0, 10),
    endDate: new Date(Date.UTC(startYear + 1, startMonth - 1, 0)).toISOString().slice(0, 10)
  };
}
