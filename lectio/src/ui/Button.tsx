import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger';
};

export function Button({ variant = 'ghost', className, ...rest }: Props) {
  return (
    <button
      type="button"
      className={`${styles.btn} ${styles[variant]} ${className ?? ''}`}
      {...rest}
    />
  );
}

/** Bouton rond d'icône, 44 px minimum. Le libellé est obligatoire pour l'accessibilité. */
export function IconButton({
  label,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`${styles.icon} ${className ?? ''}`}
      {...rest}
    />
  );
}
