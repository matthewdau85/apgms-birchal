function addDays(date: Date, delta: number): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() + delta);
  return copy;
}

export type Frequency = "M" | "Q" | "A";

export interface Period {
  start: Date;
  end: Date;
  label: string;
}

export interface ObligationBand {
  p50: number;
  p80: number;
  p90: number;
}

const MONTHS_PER_FREQUENCY: Record<Frequency, number> = {
  M: 1,
  Q: 3,
  A: 12,
};

export function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

export function inferFrequencyFromMonths(sortedMonthStarts: Date[]): Frequency {
  if (sortedMonthStarts.length <= 1) {
    return "A";
  }
  const deltas: number[] = [];
  for (let i = 1; i < sortedMonthStarts.length; i += 1) {
    deltas.push(Math.max(1, monthsBetween(sortedMonthStarts[i - 1], sortedMonthStarts[i])));
  }
  const avg = deltas.reduce((acc, value) => acc + value, 0) / deltas.length;
  if (avg <= 1.5) {
    return "M";
  }
  if (avg <= 4.5) {
    return "Q";
  }
  return "A";
}

function endOfMonth(start: Date): Date {
  return new Date(start.getFullYear(), start.getMonth() + 1, 0);
}

function frequencyMonths(frequency: Frequency): number {
  return MONTHS_PER_FREQUENCY[frequency];
}

function formatPeriodLabel(start: Date, frequency: Frequency): string {
  if (frequency === "M") {
    return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
  }
  if (frequency === "Q") {
    const quarter = Math.floor(start.getMonth() / 3) + 1;
    return `${start.getFullYear()}-Q${quarter}`;
  }
  const financialYear = start.getMonth() >= 6 ? start.getFullYear() + 1 : start.getFullYear();
  return `FY${financialYear}`;
}

function periodFromStart(start: Date, frequency: Frequency): Period {
  const normalizedStart = new Date(start.getFullYear(), start.getMonth(), 1);
  const months = frequencyMonths(frequency);
  const end = endOfMonth(new Date(normalizedStart.getFullYear(), normalizedStart.getMonth() + months - 1, 1));
  return {
    start: normalizedStart,
    end,
    label: formatPeriodLabel(normalizedStart, frequency),
  };
}

export function nextPeriods(
  lastPeriod: Period | undefined,
  frequency: Frequency,
  count: number,
): Period[] {
  if (count <= 0) {
    return [];
  }
  const periods: Period[] = [];
  let nextStart: Date;
  if (!lastPeriod) {
    const now = new Date();
    const aligned = new Date(now.getFullYear(), now.getMonth(), 1);
    nextStart = aligned;
  } else {
    nextStart = new Date(lastPeriod.start.getFullYear(), lastPeriod.start.getMonth(), 1);
    nextStart = new Date(nextStart.getFullYear(), nextStart.getMonth() + frequencyMonths(frequency), 1);
  }
  for (let i = 0; i < count; i += 1) {
    const period = periodFromStart(nextStart, frequency);
    periods.push(period);
    nextStart = new Date(period.start.getFullYear(), period.start.getMonth() + frequencyMonths(frequency), 1);
  }
  return periods;
}

function calculateDueDateForBas(period: Period, frequency: Frequency): Date {
  if (frequency === "M") {
    return new Date(period.end.getFullYear(), period.end.getMonth() + 1, 21);
  }
  if (frequency === "Q") {
    return new Date(period.end.getFullYear(), period.end.getMonth() + 1, 28);
  }
  return new Date(period.end.getFullYear(), 9, 31);
}

function calculateDueDateForPaygw(period: Period, schedule: Frequency): Date {
  if (schedule === "M") {
    return new Date(period.end.getFullYear(), period.end.getMonth() + 1, 7);
  }
  if (schedule === "Q") {
    return new Date(period.end.getFullYear(), period.end.getMonth() + 1, 28);
  }
  return new Date(period.end.getFullYear(), 6, 21);
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function calculateEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function secondMonday(year: number, month: number): Date {
  const first = new Date(year, month, 1);
  const firstDay = first.getDay();
  const offset = ((8 - firstDay) % 7) + 7;
  return new Date(year, month, 1 + offset);
}

function firstMonday(year: number, month: number): Date {
  const first = new Date(year, month, 1);
  const firstDay = first.getDay();
  const offset = (8 - firstDay) % 7;
  return new Date(year, month, 1 + offset);
}

function observed(date: Date): Date {
  if (date.getDay() === 0) {
    return addDays(date, 1);
  }
  if (date.getDay() === 6) {
    return addDays(date, 2);
  }
  return date;
}

function collectPublicHolidays(year: number): Set<string> {
  const holidays = new Set<string>();
  const add = (date: Date, includeObserved = true) => {
    holidays.add(formatDate(date));
    if (includeObserved) {
      holidays.add(formatDate(observed(date)));
    }
  };
  add(new Date(year, 0, 1));
  add(new Date(year, 0, 26));
  const easter = calculateEasterSunday(year);
  holidays.add(formatDate(addDays(easter, -2))); // Good Friday
  holidays.add(formatDate(addDays(easter, 1))); // Easter Monday
  add(new Date(year, 3, 25));
  holidays.add(formatDate(secondMonday(year, 5))); // Queen's Birthday
  holidays.add(formatDate(firstMonday(year, 9))); // Labour Day (NSW)
  add(new Date(year, 11, 25));
  add(new Date(year, 11, 26));
  return holidays;
}

function isHoliday(date: Date): boolean {
  const year = date.getFullYear();
  const holidays = collectPublicHolidays(year);
  if (holidays.has(formatDate(date))) {
    return true;
  }
  if (date.getMonth() === 0 && date.getDate() < 7) {
    const lastYear = collectPublicHolidays(year - 1);
    if (lastYear.has(formatDate(date))) {
      return true;
    }
  }
  return false;
}

export function adjustForBusinessDay(date: Date): Date {
  const adjusted = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  while (adjusted.getDay() === 0 || adjusted.getDay() === 6 || isHoliday(adjusted)) {
    adjusted.setDate(adjusted.getDate() + 1);
  }
  return adjusted;
}

export function basDueDate(period: Period, frequency: Frequency): Date {
  return adjustForBusinessDay(calculateDueDateForBas(period, frequency));
}

export function paygwDueDate(period: Period, schedule: Frequency): Date {
  return adjustForBusinessDay(calculateDueDateForPaygw(period, schedule));
}

export function createPeriodLabel(start: Date, frequency: Frequency): string {
  return formatPeriodLabel(start, frequency);
}

