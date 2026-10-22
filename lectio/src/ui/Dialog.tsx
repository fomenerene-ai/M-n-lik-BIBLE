// Boîte de dialogue modale basée sur <dialog> : focus piégé et touche Échap gérés par le navigateur.

import { useEffect, useRef, type ReactNode } from 'react';
import styles from './Dialog.module.css';

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  actions: ReactNode;
};

export function Dialog({ open, title, onClose, children, actions }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog ref={ref} className={styles.dialog} onClose={onClose} aria-labelledby="dialog-title">
      <h2 id="dialog-title" className={styles.title}>
        {title}
      </h2>
      <div className={styles.body}>{children}</div>
      <div className={styles.actions}>{actions}</div>
    </dialog>
  );
}
