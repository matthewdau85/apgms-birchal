import type { HTMLAttributes } from 'react';
import clsx from 'clsx';
import styles from './Card.module.css';

type CardProps = HTMLAttributes<HTMLDivElement> & {
  as?: keyof JSX.IntrinsicElements;
};

export const Card: React.FC<CardProps> = ({ as: Component = 'div', className, ...rest }) => (
  <Component className={clsx(styles.card, className)} {...rest} />
);
