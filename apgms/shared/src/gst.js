const DEFAULT_RATE = 0.1;
const DEFAULT_DECIMALS = 2;
const EPSILON = 1e-9;

/**
 * @typedef {'bankers' | 'tax'} RoundingMode
 */

/**
 * @typedef {Object} SupplyInput
 * @property {number} amount
 * @property {boolean} [taxable]
 * @property {string} [description]
 */

/**
 * @typedef {Object} RateRule
 * @property {'gst.act.9-70'} code
 * @property {number} [rate]
 */

/**
 * @typedef {Object} RoundingRule
 * @property {string} code
 * @property {'rounding'} type
 * @property {RoundingMode} mode
 * @property {number} [decimals]
 */

/**
 * @typedef {Object} AdjustmentRule
 * @property {string} code
 * @property {'adjustment'} type
 * @property {number} amount
 * @property {string} [reason]
 */

/**
 * @typedef {RateRule | RoundingRule | AdjustmentRule} GstRule
 */

/**
 * @typedef {Object} SupplyBreakdownItem
 * @property {string} [description]
 * @property {boolean} taxable
 * @property {number} amount
 * @property {number} gst
 * @property {string} [rule]
 */

/**
 * @typedef {Object} AdjustmentBreakdownItem
 * @property {string} code
 * @property {number} amount
 * @property {string} [reason]
 */

/**
 * @typedef {Object} GstBreakdown
 * @property {SupplyBreakdownItem[]} supplies
 * @property {AdjustmentBreakdownItem[]} adjustments
 * @property {number} rate
 * @property {{ mode: RoundingMode, decimals: number }} rounding
 */

/**
 * @typedef {Object} CalcGstResult
 * @property {number} gst_collected
 * @property {number} gst_payable
 * @property {GstBreakdown} breakdown
 */

/**
 * @param {GstRule} rule
 * @returns {rule is RoundingRule}
 */
const isRoundingRule = (rule) => rule && rule.type === 'rounding';

/**
 * @param {GstRule} rule
 * @returns {rule is AdjustmentRule}
 */
const isAdjustmentRule = (rule) => rule && rule.type === 'adjustment';

/**
 * @param {RoundingMode} mode
 * @param {number} decimals
 */
const createRounder = (mode, decimals) => {
  if (mode === 'tax') {
    return (value) => roundHalfUp(value, decimals);
  }
  return (value) => roundHalfToEven(value, decimals);
};

/**
 * Banker's rounding (half to even).
 * @param {number} value
 * @param {number} decimals
 */
const roundHalfToEven = (value, decimals) => {
  const factor = 10 ** decimals;
  const scaled = value * factor;
  const sign = Math.sign(scaled) || 1;
  const absScaled = Math.abs(scaled);
  const base = Math.floor(absScaled);
  const fraction = absScaled - base;

  if (Math.abs(fraction - 0.5) < EPSILON) {
    const rounded = (base % 2 === 0 ? base : base + 1) * sign;
    return rounded / factor;
  }

  return Math.round(scaled) / factor;
};

/**
 * Tax rounding (half up / away from zero).
 * @param {number} value
 * @param {number} decimals
 */
const roundHalfUp = (value, decimals) => {
  const factor = 10 ** decimals;
  const scaled = value * factor;
  const sign = Math.sign(scaled) || 1;
  const absScaled = Math.abs(scaled);
  const rounded = Math.floor(absScaled + 0.5 + EPSILON) * sign;
  return rounded / factor;
};

/**
 * Calculate GST for a set of supplies in accordance with GST Act s 9-70.
 * @param {SupplyInput[]} inputs
 * @param {GstRule[]} [rules=[]]
 * @returns {CalcGstResult}
 */
export const calcGst = (inputs, rules = []) => {
  const rateRule = rules.find((rule) => rule && rule.code === 'gst.act.9-70');
  const rate = rateRule && typeof rateRule.rate === 'number' ? rateRule.rate : DEFAULT_RATE;

  const roundingRule = rules.find(isRoundingRule);
  const roundingMode = roundingRule?.mode ?? 'bankers';
  const roundingDecimals = roundingRule?.decimals ?? DEFAULT_DECIMALS;
  const round = createRounder(roundingMode, roundingDecimals);

  const supplies = inputs.map((input) => {
    const taxable = input.taxable !== false;
    const gst = taxable ? round(input.amount * rate) : 0;
    return {
      description: input.description,
      taxable,
      amount: round(input.amount),
      gst,
      rule: taxable ? 'gst.act.9-70' : undefined,
    };
  });

  const gstCollected = round(
    supplies.reduce((sum, supply) => sum + supply.gst, 0)
  );

  const adjustments = rules
    .filter(isAdjustmentRule)
    .map((adjustment) => ({
      code: adjustment.code,
      amount: round(adjustment.amount),
      reason: adjustment.reason,
    }));

  const adjustmentsTotal = adjustments.reduce((sum, adjustment) => sum + adjustment.amount, 0);

  const gstPayable = round(gstCollected + adjustmentsTotal);

  return {
    gst_collected: gstCollected,
    gst_payable: gstPayable,
    breakdown: {
      supplies,
      adjustments,
      rate,
      rounding: {
        mode: roundingMode,
        decimals: roundingDecimals,
      },
    },
  };
};

