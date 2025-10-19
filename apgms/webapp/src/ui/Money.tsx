import { HTMLAttributes } from "react";

type MoneyProps = {
  value: number | null | undefined;
  currency?: string;
  locale?: string;
} & HTMLAttributes<HTMLSpanElement>;

const formatterCache = new Map<string, Intl.NumberFormat>();

function getFormatter(locale: string, currency: string) {
  const key = `${locale}-${currency}`;
  if (!formatterCache.has(key)) {
    formatterCache.set(
      key,
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        currencyDisplay: "symbol",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    );
  }
  return formatterCache.get(key)!;
}

export function Money({ value, currency = "AUD", locale = "en-AU", style, ...props }: MoneyProps) {
  const display =
    typeof value === "number"
      ? getFormatter(locale, currency).format(value)
      : "—";

  return (
    <span
      {...props}
      style={{
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "0.02em",
        ...(style || {}),
      }}
    >
      {display}
    </span>
  );
}
