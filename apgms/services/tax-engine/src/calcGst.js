const DEFAULT_PRECISION = 2;
const DEFAULT_RATE = 0.1;

function roundHalfAway(value, decimals = DEFAULT_PRECISION) {
  if (!Number.isFinite(value)) {
    return value;
  }
  if (decimals < 0) {
    throw new RangeError('decimals must be non-negative');
  }
  if (value < 0) {
    return -roundHalfAway(-value, decimals);
  }
  const factor = 10 ** decimals;
  const scaled = value * factor;
  const epsilon = 1e-8;
  const rounded = Math.floor(scaled + 0.5 + epsilon);
  return rounded / factor;
}

function roundHalfEven(value, decimals = DEFAULT_PRECISION) {
  if (!Number.isFinite(value)) {
    return value;
  }
  if (decimals < 0) {
    throw new RangeError('decimals must be non-negative');
  }
  if (value < 0) {
    return -roundHalfEven(-value, decimals);
  }
  const factor = 10 ** decimals;
  const scaled = value * factor;
  const epsilon = 1e-8;
  const floored = Math.floor(scaled + epsilon);
  const fraction = scaled - floored;
  if (Math.abs(fraction - 0.5) <= epsilon) {
    const even = floored % 2 === 0 ? floored : floored + 1;
    return even / factor;
  }
  return Math.round(scaled) / factor;
}

function applyRounding(value, mode = 'tax', decimals = DEFAULT_PRECISION) {
  if (typeof mode === 'function') {
    return mode(value, decimals);
  }
  switch (mode) {
    case 'none':
      return value;
    case 'bankers':
      return roundHalfEven(value, decimals);
    case 'tax':
    default:
      return roundHalfAway(value, decimals);
  }
}

function normaliseNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function matchesAdjustmentRule(adjustment, rule) {
  if (adjustment.rule && adjustment.rule === rule.id) {
    return true;
  }
  if (!rule.appliesTo) {
    return false;
  }
  const applies = Array.isArray(rule.appliesTo) ? rule.appliesTo : [rule.appliesTo];
  return applies.some((item) => item === adjustment.type || item === adjustment.mode);
}

export function calcGst(inputs = {}, rules = []) {
  if (!Array.isArray(rules)) {
    throw new TypeError('rules must be an array');
  }

  const baselineRule = rules.find((rule) => rule && rule.id === 'gst.act.9-70');
  if (!baselineRule) {
    throw new Error('Missing baseline GST rule gst.act.9-70');
  }

  const baselineRate = typeof baselineRule.rate === 'number' ? baselineRule.rate : DEFAULT_RATE;
  const baselinePrecision = baselineRule.precision ?? DEFAULT_PRECISION;
  const baselineRounding = baselineRule.rounding || 'tax';

  const supplies = Array.isArray(inputs.supplies) ? inputs.supplies : [];
  const adjustments = (Array.isArray(inputs.adjustments) ? inputs.adjustments : []).map((item) => ({
    ...item,
    _consumed: false,
  }));

  const breakdown = [];
  let gstCollected = 0;
  let gstPayable = 0;

  for (const supply of supplies) {
    const baseAmount = normaliseNumber(supply?.amount);
    const taxable = supply?.taxable !== false;
    const supplyPrecision = supply?.precision ?? baselinePrecision;
    const supplyRounding = supply?.rounding || baselineRounding;

    if (!taxable) {
      breakdown.push({
        type: 'supply',
        rule: baselineRule.id,
        supply_id: supply?.id,
        taxable: false,
        base_amount: baseAmount,
        gst_rate: baselineRate,
        gst_amount: 0,
        rounding: supplyRounding,
        note: 'Non-taxable supply',
      });
      continue;
    }

    const gstRaw = baseAmount * baselineRate;
    const gstRounded = applyRounding(gstRaw, supplyRounding, supplyPrecision);

    gstCollected += gstRounded;
    gstPayable += gstRounded;

    breakdown.push({
      type: 'supply',
      rule: baselineRule.id,
      supply_id: supply?.id,
      taxable: true,
      base_amount: applyRounding(baseAmount, 'tax', supplyPrecision),
      gst_rate: baselineRate,
      gst_amount: gstRounded,
      rounding: supplyRounding,
    });
  }

  for (const rule of rules) {
    if (!rule || rule.type !== 'adjustment') {
      continue;
    }
    const rulePrecision = rule.precision ?? baselinePrecision;
    const ruleRounding = rule.rounding || baselineRounding;
    const affectsCollected = Boolean(rule.affectsCollected);

    for (const adjustment of adjustments) {
      if (adjustment._consumed) {
        continue;
      }
      if (!matchesAdjustmentRule(adjustment, rule)) {
        continue;
      }

      adjustment._consumed = true;

      const amount = normaliseNumber(adjustment.amount);
      const mode = rule.mode || adjustment.mode || adjustment.type || 'credit';
      const sign = mode === 'credit' || mode === 'refund' ? -1 : 1;
      const rounded = applyRounding(amount, ruleRounding, rulePrecision);

      if (affectsCollected) {
        gstCollected += sign * rounded;
      }
      gstPayable += sign * rounded;

      breakdown.push({
        type: 'adjustment',
        rule: rule.id,
        adjustment_id: adjustment.id,
        amount: sign * rounded,
        original_amount: amount,
        mode,
        rounding: ruleRounding,
        affects_collected: affectsCollected,
      });
    }
  }

  const totalPrecision = baselineRule.totalPrecision ?? baselinePrecision;
  const totalRounding = baselineRule.totalRounding || baselineRounding;

  return {
    gst_collected: applyRounding(gstCollected, totalRounding, totalPrecision),
    gst_payable: applyRounding(gstPayable, totalRounding, totalPrecision),
    breakdown,
  };
}

export const rounding = { roundHalfAway, roundHalfEven, applyRounding };
