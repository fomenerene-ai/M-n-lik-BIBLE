import { useToasts } from './toast';
import { IconClose } from './icons';
import styles from './Toasts.module.css';

export function Toasts() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className={styles.stack} role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`${styles.toast} ${styles[t.kind]}`}>
          <span>{t.text}</span>
          <button
            className={styles.close}
            onClick={() => dismiss(t.id)}
            aria-label="Fermer le message"
          >
            <IconClose size={18} />
          </button>
        </div>
      ))}
    </div>
  );
}
