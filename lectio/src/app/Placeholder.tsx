import styles from '../features/reader/ReaderView.module.css';

export function Placeholder({ title, phase }: { title: string; phase: number }) {
  return (
    <div className={styles.placeholder}>
      <p>{title}</p>
      <p className={styles.hint}>Cette section arrive à la phase {phase}.</p>
    </div>
  );
}
