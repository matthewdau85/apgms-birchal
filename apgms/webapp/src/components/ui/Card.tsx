import type { HTMLAttributes, ReactNode } from 'react';

const baseStyles = 'rounded-xl border border-slate-200 bg-white shadow-sm';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  header?: ReactNode;
  footer?: ReactNode;
}

export const Card = ({ header, footer, className, children, ...props }: CardProps) => {
  const classes = [baseStyles, className].filter(Boolean).join(' ');

  return (
    <div className={classes} {...props}>
      {header ? <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">{header}</div> : null}
      <div className="px-4 py-3 text-sm text-slate-700">{children}</div>
      {footer ? <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">{footer}</div> : null}
    </div>
  );
};

export default Card;
