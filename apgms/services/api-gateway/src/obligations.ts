import {
  Frequency,
  Period,
  basDueDate,
  createPeriodLabel,
  inferFrequencyFromMonths,
  nextPeriods,
  paygwDueDate,
} from "../../../shared/src/au/obligations";
import { ForecastPoint, rollingForecast } from "../../../worker/src/pipeline/forecast";

export interface BankLineLike {
  date: Date;
  amount: unknown;
  desc: string;
  payee: string;
}

export interface HistoricalPoint extends Period {
  value: number;
}

interface MonthlyPoint {
  start: Date;
  value: number;
}

export interface ComposeInput {
  basHistory: HistoricalPoint[];
  payrollHistory: HistoricalPoint[];
  basFrequency: Frequency;
  paygwFrequency: Frequency;
  cashOnHandCents: number;
  basHorizon?: number;
  paygwHorizon?: number;
}

export interface ObligationView {
  type: "BAS" | "PAYGW";
  period: string;
  dueDate: string;
  forecastCents: number;
  band: ForecastPoint["band"];
}

export interface ComposeResult {
  obligations: ObligationView[];
  basFrequency: Frequency;
  paygwSchedule: Frequency;
  totalForecastCents: number;
  cashOnHandCents: number;
}

const BAS_KEYWORDS = ["bas", "gst"];
const PAYROLL_KEYWORDS = ["payroll", "salary", "wages"];

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function normalizeDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function amountToNumber(amount: unknown): number {
  if (typeof amount === "number") {
    return amount;
  }
  if (typeof amount === "string") {
    return Number.parseFloat(amount);
  }
  if (amount && typeof amount === "object") {
    if ("toNumber" in amount && typeof (amount as any).toNumber === "function") {
      return (amount as any).toNumber();
    }
    if ("valueOf" in amount) {
      const v = Number((amount as any).valueOf());
      if (Number.isFinite(v)) {
        return v;
      }
    }
  }
  return 0;
}

function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(start: Date): Date {
  return new Date(start.getFullYear(), start.getMonth() + 1, 0);
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function isKeywordMatch(value: string, keywords: string[]): boolean {
  const lower = value.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
}

export function splitBankLines(lines: BankLineLike[]): {
  basMonthly: MonthlyPoint[];
  payrollMonthly: MonthlyPoint[];
  cashOnHandCents: number;
} {
  const basMap = new Map<string, MonthlyPoint>();
  const payrollMap = new Map<string, MonthlyPoint>();
  let cashOnHand = 0;
  for (const line of lines) {
    const date = monthStart(normalizeDate(line.date));
    const amount = amountToNumber(line.amount);
    const cents = Math.round(amount * 100);
    cashOnHand += cents;
    const key = monthKey(date);
    const absCents = Math.abs(cents);
    if (isKeywordMatch(line.desc ?? "", BAS_KEYWORDS) || isKeywordMatch(line.payee ?? "", BAS_KEYWORDS)) {
      const existing = basMap.get(key) ?? { start: date, value: 0 };
      existing.value += absCents;
      basMap.set(key, existing);
    }
    if (isKeywordMatch(line.desc ?? "", PAYROLL_KEYWORDS) || isKeywordMatch(line.payee ?? "", PAYROLL_KEYWORDS)) {
      const existing = payrollMap.get(key) ?? { start: date, value: 0 };
      existing.value += absCents;
      payrollMap.set(key, existing);
    }
  }
  const basMonthly = Array.from(basMap.values()).sort((a, b) => a.start.getTime() - b.start.getTime());
  const payrollMonthly = Array.from(payrollMap.values()).sort((a, b) => a.start.getTime() - b.start.getTime());
  return { basMonthly, payrollMonthly, cashOnHandCents: cashOnHand };
}

export function groupMonthly(points: MonthlyPoint[], frequency: Frequency): HistoricalPoint[] {
  if (points.length === 0) {
    return [];
  }
  if (frequency === "M") {
    return points.map((point) => ({
      start: point.start,
      end: endOfMonth(point.start),
      label: createPeriodLabel(point.start, "M"),
      value: Math.round(point.value),
    }));
  }
  if (frequency === "Q") {
    const quarters = new Map<string, { start: Date; value: number }>();
    for (const point of points) {
      const startMonth = Math.floor(point.start.getMonth() / 3) * 3;
      const start = new Date(point.start.getFullYear(), startMonth, 1);
      const key = `${start.getFullYear()}-${start.getMonth()}`;
      const existing = quarters.get(key) ?? { start, value: 0 };
      existing.value += point.value;
      quarters.set(key, existing);
    }
    return Array.from(quarters.values())
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .map((entry) => ({
        start: entry.start,
        end: new Date(entry.start.getFullYear(), entry.start.getMonth() + 3, 0),
        label: createPeriodLabel(entry.start, "Q"),
        value: Math.round(entry.value),
      }));
  }
  const years = new Map<string, { start: Date; value: number }>();
  for (const point of points) {
    const financialYear = point.start.getMonth() >= 6 ? point.start.getFullYear() + 1 : point.start.getFullYear();
    const start = new Date(financialYear - 1, 6, 1);
    const key = `${financialYear}`;
    const existing = years.get(key) ?? { start, value: 0 };
    existing.value += point.value;
    years.set(key, existing);
  }
  return Array.from(years.values())
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .map((entry) => ({
      start: entry.start,
      end: new Date(entry.start.getFullYear() + 1, 5, 30),
      label: createPeriodLabel(entry.start, "A"),
      value: Math.round(entry.value),
    }));
}

function seasonLengthForFrequency(frequency: Frequency): number {
  if (frequency === "M") {
    return 12;
  }
  if (frequency === "Q") {
    return 4;
  }
  return 1;
}

function horizonForFrequency(frequency: Frequency): number {
  if (frequency === "M") {
    return 3;
  }
  if (frequency === "Q") {
    return 2;
  }
  return 1;
}

function applyForecast(periods: HistoricalPoint[], frequency: Frequency, horizon: number): {
  futurePeriods: Period[];
  forecast: ForecastPoint[];
} {
  const seasonLength = seasonLengthForFrequency(frequency);
  const series = periods.map((point) => point.value);
  const forecast = rollingForecast(series, {
    horizon,
    seasonLength,
    evaluationWindow: Math.min(3, Math.max(1, periods.length)),
  });
  const lastPeriod = periods[periods.length - 1];
  const futurePeriods = nextPeriods(lastPeriod, frequency, horizon);
  return { futurePeriods, forecast: forecast.points };
}

function toView(
  type: ObligationView["type"],
  periods: Period[],
  forecast: ForecastPoint[],
  dueDateFactory: (period: Period) => Date,
): ObligationView[] {
  const size = Math.min(periods.length, forecast.length);
  const views: ObligationView[] = [];
  for (let i = 0; i < size; i += 1) {
    const period = periods[i];
    const estimate = forecast[i];
    const dueDate = dueDateFactory(period);
    views.push({
      type,
      period: period.label,
      dueDate: formatDate(dueDate),
      forecastCents: estimate.value,
      band: estimate.band,
    });
  }
  return views;
}

export function composeUpcomingObligations(input: ComposeInput): ComposeResult {
  const basHorizon = input.basHorizon ?? horizonForFrequency(input.basFrequency);
  const paygwHorizon = input.paygwHorizon ?? horizonForFrequency(input.paygwFrequency);
  const basForecast = applyForecast(input.basHistory, input.basFrequency, basHorizon);
  const paygwForecast = applyForecast(input.payrollHistory, input.paygwFrequency, paygwHorizon);
  const basViews = toView("BAS", basForecast.futurePeriods, basForecast.forecast, (period) => basDueDate(period, input.basFrequency));
  const paygwViews = toView("PAYGW", paygwForecast.futurePeriods, paygwForecast.forecast, (period) => paygwDueDate(period, input.paygwFrequency));
  const obligations = [...basViews, ...paygwViews].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const totalForecastCents = obligations.reduce((acc, item) => acc + item.forecastCents, 0);
  return {
    obligations,
    basFrequency: input.basFrequency,
    paygwSchedule: input.paygwFrequency,
    totalForecastCents,
    cashOnHandCents: input.cashOnHandCents,
  };
}

export function deriveHistories(lines: BankLineLike[]): {
  basHistory: HistoricalPoint[];
  payrollHistory: HistoricalPoint[];
  basFrequency: Frequency;
  paygwFrequency: Frequency;
  cashOnHandCents: number;
} {
  const { basMonthly, payrollMonthly, cashOnHandCents } = splitBankLines(lines);
  const basMonths = basMonthly.map((point) => point.start);
  const payrollMonths = payrollMonthly.map((point) => point.start);
  const basFrequency = basMonths.length ? inferFrequencyFromMonths(basMonths) : "Q";
  const paygwFrequency = payrollMonths.length ? inferFrequencyFromMonths(payrollMonths) : "M";
  const basHistory = groupMonthly(basMonthly, basFrequency);
  const payrollHistory = groupMonthly(payrollMonthly, paygwFrequency);
  return {
    basHistory,
    payrollHistory,
    basFrequency,
    paygwFrequency,
    cashOnHandCents,
  };
}

