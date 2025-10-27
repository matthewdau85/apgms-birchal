import schemaJson from './schema/stp2.schema.json' with { type: 'json' };

export interface StpValidationError {
  /**
   * JSON pointer indicating the field that violated a rule.
   * Missing properties are expressed using the property path that failed.
   */
  path: string;
  /**
   * Identifier of the breached business rule as defined by the ATO BIG.
   */
  ruleId: string;
  /**
   * Human-readable explanation of the failure.
   */
  message: string;
}

type JsonRecord = Record<string, unknown>;

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ABN_REGEX = /^\d{11}$/;
const BRANCH_NUMBER_REGEX = /^\d{3}$/;
const BMS_IDENTIFIER_REGEX = /^[A-Za-z0-9-]{1,60}$/;
const TFN_REGEX = /^\d{9}$/;
const PHONE_REGEX = /^\+?[0-9 ]{6,20}$/;

const TAX_TREATMENT_CATEGORIES = new Set([
  'RT',
  'RTS',
  'R',
  'NR',
  'WHM',
  'FEI',
  'JPP',
  'HNW'
]);

const EMPLOYMENT_BASIS = new Set([
  'FullTime',
  'PartTime',
  'Casual',
  'LabourHire',
  'VoluntaryAgreement',
  'DeathBeneficiary',
  'NonEmployee'
]);

const PAYMENT_TYPES = new Set(['SALARY', 'ALLOWANCE', 'LUMP_SUM', 'BONUS']);

const RULE_MESSAGES: Record<string, string> = {
  'STP2-R-0001': 'payEvent must be supplied as an object.',
  'STP2-R-0002': 'employer must be supplied as an object.',
  'STP2-R-0003': 'employees must contain at least one employee.',
  'STP2-R-0004': 'bmsIdentifier must be 1-60 characters using letters, numbers or hyphen.',
  'STP2-R-0101': 'ABN must be an 11 digit numeric string.',
  'STP2-R-0102': 'Branch number must be a three digit string.',
  'STP2-R-0201': 'Tax file number must be a nine digit numeric string.',
  'STP2-R-0202': 'Tax treatment category must be a valid STP Phase 2 code.',
  'STP2-R-0203': 'Employment basis must be a valid STP Phase 2 code.',
  'STP2-R-0204': 'Date of birth must use ISO 8601 date format (YYYY-MM-DD).',
  'STP2-R-0301': 'Payment date must use ISO 8601 date format (YYYY-MM-DD).',
  'STP2-R-0401': 'Payments collection must contain at least one item.',
  'STP2-R-0402': 'Gross amount must be a positive number.',
  'STP2-R-0403': 'Tax withheld must be zero or a positive number.',
  'STP2-R-0501': 'Payment type must be a valid STP Phase 2 code.',
  'STP2-R-0502': 'Payment period dates must use ISO 8601 date format (YYYY-MM-DD).',
  'STP2-R-0601': 'Unexpected additional properties encountered.',
  'STP2-R-0000': 'Validation rule breached.',
  'STP2-R-9999': 'Unknown validation rule breached.'
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function pushError(errors: StpValidationError[], path: string, ruleId: string, overrideMessage?: string) {
  errors.push({
    path,
    ruleId,
    message: overrideMessage ?? RULE_MESSAGES[ruleId] ?? RULE_MESSAGES['STP2-R-9999']
  });
}

function validateContact(contact: unknown, errors: StpValidationError[], basePath: string) {
  if (!isRecord(contact)) {
    pushError(errors, `${basePath}`, 'STP2-R-0002', 'Contact details must be supplied.');
    return;
  }

  const { name, phone, email } = contact;
  if (isString(name)) {
    if (name.length === 0 || name.length > 200) {
      pushError(errors, `${basePath}/name`, 'STP2-R-0000', 'Contact name must be between 1 and 200 characters.');
    }
  } else {
    pushError(errors, `${basePath}/name`, 'STP2-R-0000', 'Contact name is required.');
  }

  if (isString(phone)) {
    if (!PHONE_REGEX.test(phone)) {
      pushError(errors, `${basePath}/phone`, 'STP2-R-0000', 'Contact phone must contain 6 to 20 digits.');
    }
  } else {
    pushError(errors, `${basePath}/phone`, 'STP2-R-0000', 'Contact phone is required.');
  }

  if (isString(email)) {
    if (!email.includes('@')) {
      pushError(errors, `${basePath}/email`, 'STP2-R-0000', 'Contact email must contain an @ symbol.');
    }
  } else {
    pushError(errors, `${basePath}/email`, 'STP2-R-0000', 'Contact email is required.');
  }
}

function validatePayments(payments: unknown, errors: StpValidationError[], basePath: string) {
  if (!Array.isArray(payments) || payments.length === 0) {
    pushError(errors, basePath, 'STP2-R-0401');
    return;
  }

  payments.forEach((payment, paymentIndex) => {
    const paymentPath = `${basePath}/${paymentIndex}`;
    if (!isRecord(payment)) {
      pushError(errors, paymentPath, 'STP2-R-0401', 'Each payment must be an object.');
      return;
    }

    const { type, grossAmount, taxWithheld, payPeriodStart, payPeriodEnd } = payment;

    if (!isString(type) || !PAYMENT_TYPES.has(type)) {
      pushError(errors, `${paymentPath}/type`, 'STP2-R-0501');
    }

    if (!isNumber(grossAmount) || grossAmount <= 0) {
      pushError(errors, `${paymentPath}/grossAmount`, 'STP2-R-0402');
    }

    if (!isNumber(taxWithheld) || taxWithheld < 0) {
      pushError(errors, `${paymentPath}/taxWithheld`, 'STP2-R-0403');
    }

    if (!isString(payPeriodStart) || !DATE_REGEX.test(payPeriodStart)) {
      pushError(errors, `${paymentPath}/payPeriodStart`, 'STP2-R-0502');
    }

    if (!isString(payPeriodEnd) || !DATE_REGEX.test(payPeriodEnd)) {
      pushError(errors, `${paymentPath}/payPeriodEnd`, 'STP2-R-0502');
    }
  });
}

function validateEmployees(employees: unknown, errors: StpValidationError[], basePath: string) {
  if (!Array.isArray(employees) || employees.length === 0) {
    pushError(errors, basePath, 'STP2-R-0003');
    return;
  }

  employees.forEach((employee, employeeIndex) => {
    const employeePath = `${basePath}/${employeeIndex}`;
    if (!isRecord(employee)) {
      pushError(errors, employeePath, 'STP2-R-0003', 'Each employee must be an object.');
      return;
    }

    const {
      taxFileNumber,
      taxTreatmentCategory,
      employmentBasis,
      dateOfBirth,
      payments
    } = employee;

    if (!isString(taxFileNumber) || !TFN_REGEX.test(taxFileNumber)) {
      pushError(errors, `${employeePath}/taxFileNumber`, 'STP2-R-0201');
    }

    if (!isString(taxTreatmentCategory) || !TAX_TREATMENT_CATEGORIES.has(taxTreatmentCategory)) {
      pushError(errors, `${employeePath}/taxTreatmentCategory`, 'STP2-R-0202');
    }

    if (!isString(employmentBasis) || !EMPLOYMENT_BASIS.has(employmentBasis)) {
      pushError(errors, `${employeePath}/employmentBasis`, 'STP2-R-0203');
    }

    if (dateOfBirth !== undefined) {
      if (!isString(dateOfBirth) || !DATE_REGEX.test(dateOfBirth)) {
        pushError(errors, `${employeePath}/dateOfBirth`, 'STP2-R-0204');
      }
    }

    validatePayments(payments, errors, `${employeePath}/payments`);
  });
}

export function validateStp2(payload: unknown): StpValidationError[] {
  const errors: StpValidationError[] = [];

  if (!isRecord(payload)) {
    pushError(errors, '/', 'STP2-R-0001', 'Payload must be an object with a payEvent property.');
    return errors;
  }

  const payEvent = (payload as JsonRecord).payEvent;
  if (!isRecord(payEvent)) {
    pushError(errors, '/payEvent', 'STP2-R-0001');
    return errors;
  }

  const { bmsIdentifier, paymentDate, employer, employees } = payEvent;

  if (!isString(bmsIdentifier) || !BMS_IDENTIFIER_REGEX.test(bmsIdentifier)) {
    pushError(errors, '/payEvent/bmsIdentifier', 'STP2-R-0004');
  }

  if (!isString(paymentDate) || !DATE_REGEX.test(paymentDate)) {
    pushError(errors, '/payEvent/paymentDate', 'STP2-R-0301');
  }

  if (!isRecord(employer)) {
    pushError(errors, '/payEvent/employer', 'STP2-R-0002');
  } else {
    const { abn, branchNumber, contact } = employer as JsonRecord;

    if (!isString(abn) || !ABN_REGEX.test(abn)) {
      pushError(errors, '/payEvent/employer/abn', 'STP2-R-0101');
    }

    if (!isString(branchNumber) || !BRANCH_NUMBER_REGEX.test(branchNumber)) {
      pushError(errors, '/payEvent/employer/branchNumber', 'STP2-R-0102');
    }

    validateContact(contact, errors, '/payEvent/employer/contact');
  }

  validateEmployees(employees, errors, '/payEvent/employees');

  return errors;
}

export const stp2Schema = schemaJson;
