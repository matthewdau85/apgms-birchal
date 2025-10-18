import type { ButtonHTMLAttributes, ReactNode } from 'react';

const baseStyles =
  'inline-flex items-center justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60';

const variants: Record<'primary' | 'secondary' | 'ghost', string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 focus-visible:outline-blue-600',
  secondary: 'bg-slate-100 text-slate-900 hover:bg-slate-200 focus-visible:outline-slate-400',
  ghost: 'bg-transparent text-slate-700 hover:bg-slate-100 focus-visible:outline-slate-300',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Button = ({
  variant = 'primary',
  leftIcon,
  rightIcon,
  className,
  children,
  ...props
}: ButtonProps) => {
  const classes = [baseStyles, variants[variant], className].filter(Boolean).join(' ');

  return (
    <button className={classes} {...props}>
      {leftIcon ? <span className="mr-2 inline-flex items-center">{leftIcon}</span> : null}
      <span>{children}</span>
      {rightIcon ? <span className="ml-2 inline-flex items-center">{rightIcon}</span> : null}
    </button>
  );
};

export default Button;
