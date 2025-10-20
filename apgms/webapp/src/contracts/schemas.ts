export type SafeParseSuccess<T> = {
  readonly success: true;
  readonly data: T;
};

export type SafeParseFailure = {
  readonly success: false;
  readonly issues: readonly string[];
};

export type SafeParseResult<T> = SafeParseSuccess<T> | SafeParseFailure;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isIsoDateString = (value: unknown): value is string =>
  isNonEmptyString(value) && !Number.isNaN(Date.parse(value));

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const buildFailure = (...issues: string[]): SafeParseFailure => ({
  success: false,
  issues,
});

export type AllocationPreview = {
  readonly id: string;
  readonly label: string;
  readonly limit: number;
  readonly currency: string;
  readonly updatedAt: string;
};

const isAllocationPreview = (value: unknown): value is AllocationPreview => {
  if (!isPlainObject(value)) {
    return false;
  }

  const { id, label, limit, currency, updatedAt } = value;

  return (
    isNonEmptyString(id) &&
    isNonEmptyString(label) &&
    isFiniteNumber(limit) &&
    isNonEmptyString(currency) &&
    isIsoDateString(updatedAt)
  );
};

export const AllocationPreviewV = {
  safeParse(value: unknown): SafeParseResult<AllocationPreview> {
    if (!isAllocationPreview(value)) {
      return buildFailure("Invalid allocation preview payload");
    }

    return { success: true, data: value };
  },
};

export type Rpt = {
  readonly id: string;
  readonly status: string;
  readonly generatedAt: string;
  readonly summary: string;
  readonly advanced?: Readonly<Record<string, string | number | boolean | null>>;
};

const isAdvancedFields = (
  value: unknown,
): value is Record<string, string | number | boolean | null> => {
  if (!isPlainObject(value)) {
    return false;
  }

  return Object.values(value).every((entry) => {
    const type = typeof entry;
    return (
      entry === null ||
      type === "string" ||
      type === "number" ||
      type === "boolean"
    );
  });
};

const isRpt = (value: unknown): value is Rpt => {
  if (!isPlainObject(value)) {
    return false;
  }

  const { id, status, generatedAt, summary, advanced } = value;

  if (
    !(
      isNonEmptyString(id) &&
      isNonEmptyString(status) &&
      isIsoDateString(generatedAt) &&
      isNonEmptyString(summary)
    )
  ) {
    return false;
  }

  if (typeof advanced === "undefined") {
    return true;
  }

  return isAdvancedFields(advanced);
};

export const RptV = {
  safeParse(value: unknown): SafeParseResult<Rpt> {
    if (!isRpt(value)) {
      return buildFailure("Invalid RPT payload");
    }

    return { success: true, data: value };
  },
};
