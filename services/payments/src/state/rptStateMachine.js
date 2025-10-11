/**
 * @typedef {'pending' | 'valid' | 'expired' | 'revoked'} RptStatus
 * @typedef {import('../rails/IPaymentRail.js').Mandate} Mandate
 */

const transitions = {
  pending: {
    verified: 'valid',
    expired: 'expired',
    revoked: 'revoked'
  },
  valid: {
    verified: 'valid',
    expired: 'expired',
    revoked: 'revoked'
  },
  expired: {
    verified: 'valid',
    expired: 'expired',
    revoked: 'revoked'
  },
  revoked: {
    verified: 'revoked',
    expired: 'revoked',
    revoked: 'revoked'
  }
};

/**
 * @param {RptStatus} current
 * @param {'verified' | 'expired' | 'revoked'} event
 * @returns {RptStatus}
 */
export function applyRptEvent(current, event) {
  return transitions[current]?.[event] ?? current;
}

/**
 * @typedef {{ valid: boolean, validUntil?: Date }} RptVerificationResult
 */

/**
 * @param {Mandate} mandate
 * @param {Date} now
 * @param {() => RptVerificationResult} verifier
 * @returns {Mandate}
 */
export function ensureRptValidity(mandate, now, verifier) {
  if (mandate.rptStatus === 'revoked') {
    throw new Error(`Mandate ${mandate.id} has been revoked.`);
  }

  if (mandate.rptStatus === 'valid' && mandate.rptValidUntil && mandate.rptValidUntil.getTime() < now.getTime()) {
    mandate.rptStatus = applyRptEvent(mandate.rptStatus, 'expired');
  }

  if (mandate.rptStatus !== 'valid') {
    const verification = verifier();
    if (!verification.valid || !verification.validUntil) {
      mandate.rptStatus = applyRptEvent(mandate.rptStatus, 'revoked');
      throw new Error(`Mandate ${mandate.id} failed RPT verification.`);
    }

    mandate.rptStatus = applyRptEvent(mandate.rptStatus, 'verified');
    mandate.rptValidUntil = verification.validUntil;
    mandate.rptVerifiedAt = now;
  }

  if (mandate.rptValidUntil && mandate.rptValidUntil.getTime() < now.getTime()) {
    mandate.rptStatus = applyRptEvent(mandate.rptStatus, 'expired');
    throw new Error(`Mandate ${mandate.id} RPT authority expired.`);
  }

  return mandate;
}

/**
 * @returns {RptVerificationResult}
 */
export function stubVerifyRpt() {
  const validUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return {
    valid: true,
    validUntil
  };
}
