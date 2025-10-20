import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';
import clsx from 'clsx';
import styles from './Button.module.css';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & PropsWithChildren & {
  variant?: 'primary' | 'outline' | 'ghost';
  size?: 'sm' | 'md';
};

export const Button = ({
  className,
  children,
  variant = 'primary',
  size = 'md',
  ...rest
}: ButtonProps) => {
  return (
    <button className={clsx(styles.button, styles[variant], styles[size], className)} {...rest}>
      {children}
    </button>
  );
};
