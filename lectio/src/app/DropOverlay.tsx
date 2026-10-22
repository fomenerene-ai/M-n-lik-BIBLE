// Glisser-déposer de fichiers n'importe où dans l'application.

import { useEffect, useState } from 'react';
import { useLibrary } from '../features/library/store';
import { navigate } from './router';
import styles from './App.module.css';

export function DropOverlay() {
  const [active, setActive] = useState(false);
  const importFiles = useLibrary((s) => s.importFiles);
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth += 1;
      setActive(true);
    };
    const onLeave = () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setActive(false);
    };
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setActive(false);
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        navigate({ name: 'library' });
        void importFiles(files);
      }
    };
    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('dragover', onOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('drop', onDrop);
    };
  }, [importFiles]);
  if (!active) return null;
  return (
    <div className={styles.drop} aria-hidden="true">
      <p>Dépose tes fichiers pour les importer</p>
    </div>
  );
}
