// Petit menu contextuel ancré sous un bouton. Se ferme au clic extérieur ou sur Échap.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { IconButton } from './Button';
import { IconMore } from './icons';
import styles from './Menu.module.css';

export type MenuItem = { label: string; onSelect: () => void; danger?: boolean; icon?: ReactNode };

export function Menu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div className={styles.wrap} ref={ref}>
      <IconButton
        label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
      >
        <IconMore size={20} />
      </IconButton>
      {open && (
        <div className={styles.menu} role="menu">
          {items.map((item) => (
            <button
              key={item.label}
              role="menuitem"
              className={`${styles.item} ${item.danger ? styles.danger : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
