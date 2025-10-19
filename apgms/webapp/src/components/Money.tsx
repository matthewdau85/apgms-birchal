import React from 'react';

type MoneyProps = {
  value: number;
  currency?: string;
  locale?: string;
};

const Money: React.FC<MoneyProps> = ({ value, currency = 'AUD', locale = 'en-AU' }) => {
  const formatter = React.useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        currencyDisplay: 'symbol',
        maximumFractionDigits: 0,
      }),
    [currency, locale]
  );

  return <span>{formatter.format(value)}</span>;
};

export default Money;
