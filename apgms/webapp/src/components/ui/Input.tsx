import type { InputHTMLAttributes } from 'react';

const baseStyles =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-100';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = ({ className, ...props }: InputProps) => {
  const classes = [baseStyles, className].filter(Boolean).join(' ');
  return <input className={classes} {...props} />;
};

export default Input;
