export type ForecastMethod = "ewma" | "seasonal-naive";

export interface ForecastBand {
  p50: number;
  p80: number;
  p90: number;
}

export interface ForecastPoint {
  value: number;
  band: ForecastBand;
}

export interface ForecastResult {
  method: ForecastMethod;
  points: ForecastPoint[];
}

export interface ForecastOptions {
  horizon: number;
  seasonLength?: number;
  evaluationWindow?: number;
  alpha?: number;
}

interface ForecastCandidate {
  method: ForecastMethod;
  forecasts: number[];
  evaluationActuals: number[];
  evaluationForecasts: number[];
  residuals: number[];
}

function clampHorizon(horizon: number): number {
  return Math.max(1, Math.min(12, Math.floor(horizon)));
}

function toInt(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) {
    return Math.round(value);
  }
  return Math.round(value);
}

function computeMape(actuals: number[], forecasts: number[], window: number): number {
  if (!actuals.length || actuals.length !== forecasts.length) {
    return Number.POSITIVE_INFINITY;
  }
  const start = Math.max(0, actuals.length - window);
  let errorSum = 0;
  let count = 0;
  for (let i = start; i < actuals.length; i += 1) {
    const actual = actuals[i];
    if (actual === 0) {
      continue;
    }
    errorSum += Math.abs((actual - forecasts[i]) / actual);
    count += 1;
  }
  if (count === 0) {
    return Number.POSITIVE_INFINITY;
  }
  return (errorSum / count) * 100;
}

function ewmaCandidate(values: number[], options: ForecastOptions): ForecastCandidate {
  const alpha = options.alpha ?? 0.35;
  const horizon = clampHorizon(options.horizon);
  if (values.length === 0) {
    return {
      method: "ewma",
      forecasts: Array(horizon).fill(0),
      evaluationActuals: [],
      evaluationForecasts: [],
      residuals: [],
    };
  }
  let level = values[0];
  const evaluationActuals: number[] = [];
  const evaluationForecasts: number[] = [];
  const residuals: number[] = [];
  for (let i = 1; i < values.length; i += 1) {
    const forecast = level;
    const actual = values[i];
    evaluationActuals.push(actual);
    evaluationForecasts.push(forecast);
    residuals.push(actual - forecast);
    level = alpha * actual + (1 - alpha) * level;
  }
  const forecasts: number[] = [];
  for (let i = 0; i < horizon; i += 1) {
    forecasts.push(level);
  }
  return {
    method: "ewma",
    forecasts,
    evaluationActuals,
    evaluationForecasts,
    residuals,
  };
}

function seasonalCandidate(values: number[], options: ForecastOptions): ForecastCandidate {
  const seasonLength = options.seasonLength ?? 12;
  const horizon = clampHorizon(options.horizon);
  if (values.length === 0) {
    return {
      method: "seasonal-naive",
      forecasts: Array(horizon).fill(0),
      evaluationActuals: [],
      evaluationForecasts: [],
      residuals: [],
    };
  }
  if (values.length < seasonLength + 1) {
    const fallback = ewmaCandidate(values, options);
    return { ...fallback, method: "seasonal-naive" };
  }
  const evaluationActuals: number[] = [];
  const evaluationForecasts: number[] = [];
  const residuals: number[] = [];
  for (let i = seasonLength; i < values.length; i += 1) {
    const forecast = values[i - seasonLength];
    const actual = values[i];
    evaluationActuals.push(actual);
    evaluationForecasts.push(forecast);
    residuals.push(actual - forecast);
  }
  const lastSeason = values.slice(-seasonLength);
  const forecasts: number[] = [];
  for (let i = 0; i < horizon; i += 1) {
    forecasts.push(lastSeason[i % seasonLength]);
  }
  return {
    method: "seasonal-naive",
    forecasts,
    evaluationActuals,
    evaluationForecasts,
    residuals,
  };
}

function selectCandidate(values: number[], options: ForecastOptions): ForecastCandidate {
  const horizon = clampHorizon(options.horizon);
  const evaluationWindow = Math.max(1, Math.min(options.evaluationWindow ?? 3, values.length));
  const candidates = [ewmaCandidate(values, options), seasonalCandidate(values, options)];
  const scored = candidates.map((candidate) => {
    const window = Math.min(evaluationWindow, candidate.evaluationActuals.length || evaluationWindow);
    const mape = computeMape(candidate.evaluationActuals, candidate.evaluationForecasts, window);
    return { candidate, mape, window };
  });
  scored.sort((a, b) => {
    if (a.mape === b.mape) {
      return a.candidate.method === "seasonal-naive" ? -1 : 1;
    }
    return a.mape - b.mape;
  });
  if (
    scored[0].candidate.method === "seasonal-naive" &&
    scored.length > 1 &&
    scored[1].candidate.method === "ewma" &&
    isMonotonic(values)
  ) {
    const gap = scored[1].mape - scored[0].mape;
    if (!Number.isFinite(gap) || gap <= 5) {
      return scored[1].candidate;
    }
  }
  return scored[0].candidate;
}

function isMonotonic(values: number[]): boolean {
  if (values.length < 3) {
    return false;
  }
  let positive = 0;
  let negative = 0;
  for (let i = 1; i < values.length; i += 1) {
    const diff = values[i] - values[i - 1];
    if (diff > 0) {
      positive += 1;
    } else if (diff < 0) {
      negative += 1;
    }
  }
  const steps = values.length - 1;
  return positive === steps || negative === steps;
}

function bandFromResiduals(value: number, residuals: number[], window: number): ForecastBand {
  if (!residuals.length) {
    const base = toInt(value);
    const spread = Math.max(Math.abs(base) * 0.1, 1000);
    return {
      p50: base,
      p80: toInt(base + spread * 1.2815),
      p90: toInt(base + spread * 1.6449),
    };
  }
  const start = Math.max(0, residuals.length - window);
  const subset = residuals.slice(start);
  const mae = subset.reduce((acc, residual) => acc + Math.abs(residual), 0) / subset.length;
  const base = toInt(value);
  const sigma = Math.max(mae, Math.abs(base) * 0.05);
  return {
    p50: base,
    p80: toInt(base + sigma * 1.2815),
    p90: toInt(base + sigma * 1.6449),
  };
}

export function forecastSeries(values: number[], options: ForecastOptions): ForecastResult {
  const safeValues = values.map((v) => Number.isFinite(v) ? v : 0);
  const candidate = selectCandidate(safeValues, options);
  const window = Math.max(1, Math.min(options.evaluationWindow ?? 3, candidate.residuals.length || 1));
  const points = candidate.forecasts.map((forecast) => ({
    value: toInt(forecast),
    band: bandFromResiduals(forecast, candidate.residuals, window),
  }));
  return {
    method: candidate.method,
    points,
  };
}

export function rollingForecast(values: number[], options: ForecastOptions): ForecastResult {
  const horizon = clampHorizon(options.horizon);
  const points: ForecastPoint[] = [];
  const scratch = [...values];
  let method: ForecastMethod = "ewma";
  for (let i = 0; i < horizon; i += 1) {
    const result = forecastSeries(scratch, { ...options, horizon: 1 });
    method = result.method;
    const nextValue = result.points[0].value;
    points.push(result.points[0]);
    scratch.push(nextValue);
  }
  return { method, points };
}

