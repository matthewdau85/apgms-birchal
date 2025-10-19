import { HTMLAttributes } from "react";

type DateTextProps = {
  value: string | Date;
  locale?: string;
  options?: Intl.DateTimeFormatOptions;
} & HTMLAttributes<HTMLTimeElement>;

const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getDateFormatter(locale: string, options: Intl.DateTimeFormatOptions) {
  const key = `${locale}:${JSON.stringify(options)}`;
  if (!dateFormatterCache.has(key)) {
    dateFormatterCache.set(key, new Intl.DateTimeFormat(locale, options));
  }
  return dateFormatterCache.get(key)!;
}

export function DateText({
  value,
  locale = "en-AU",
  options = { year: "numeric", month: "short", day: "numeric" },
  style,
  ...props
}: DateTextProps) {
  const date = typeof value === "string" ? new Date(value) : value;
  const formatted = getDateFormatter(locale, options).format(date);

  return (
    <time
      {...props}
      dateTime={date.toISOString()}
      style={{
        fontVariantNumeric: "tabular-nums",
        ...(style || {}),
      }}
    >
      {formatted}
    </time>
  );
}
