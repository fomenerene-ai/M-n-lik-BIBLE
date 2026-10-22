import { useEffect } from 'react';
import type { DocMeta } from '../../core/model';
import { formatDuration, listeningMinutes } from '../../core/text/estimate';
import { navigate } from '../../app/router';
import { Button } from '../../ui/Button';
import { Menu } from '../../ui/Menu';
import { IconTrash, IconUpload } from '../../ui/icons';
import { useLibrary } from './store';
import { useFilePicker } from './useFilePicker';
import styles from './LibraryView.module.css';

const FORMAT_LABEL: Record<DocMeta['format'], string> = {
  pdf: 'PDF',
  docx: 'Word',
  epub: 'ePub',
  txt: 'Texte',
  md: 'Markdown',
  html: 'HTML',
  image: 'Image',
};

function DocCard({ doc }: { doc: DocMeta }) {
  const trash = useLibrary((s) => s.trash);
  const remaining = listeningMinutes(doc.chars * (1 - doc.progress));
  const open = () => navigate({ name: 'reader', docId: doc.id });
  return (
    <li className={styles.card}>
      <button className={styles.cardMain} onClick={open}>
        <span className={styles.cover} data-format={doc.format} aria-hidden="true">
          <span>{doc.format === 'image' ? 'IMG' : doc.format}</span>
        </span>
        <span className={styles.info}>
          <span className={styles.title}>{doc.title}</span>
          {doc.author && <span className={styles.author}>{doc.author}</span>}
          <span className={styles.meta}>
            {FORMAT_LABEL[doc.format]} · {doc.langMain.toUpperCase()} ·{' '}
            {doc.progress > 0 ? `reste ${formatDuration(remaining)}` : formatDuration(remaining)}
          </span>
          <span
            className={styles.progress}
            role="progressbar"
            aria-label="Progression"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(doc.progress * 100)}
          >
            <span style={{ width: `${doc.progress * 100}%` }} />
          </span>
        </span>
      </button>
      <Menu
        label={`Actions pour ${doc.title}`}
        items={[
          {
            label: 'Mettre à la corbeille',
            danger: true,
            icon: <IconTrash size={20} />,
            onSelect: () => void trash(doc.id),
          },
        ]}
      />
    </li>
  );
}

export function LibraryView() {
  const { docs, loaded, importing, load } = useLibrary();
  const pick = useFilePicker();
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.h1}>Classeur</h1>
          <p className={styles.count}>
            {docs.length === 0
              ? 'Aucun document'
              : `${docs.length} document${docs.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <Button variant="primary" onClick={pick}>
          <IconUpload size={20} />
          Importer
        </Button>
      </header>

      {importing.length > 0 && (
        <div className={styles.importing} role="status">
          <span className={styles.spinner} aria-hidden="true" />
          Import en cours : {importing.join(', ')}
        </div>
      )}

      {loaded && docs.length === 0 && importing.length === 0 && (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Ton classeur est vide</p>
          <p className={styles.emptyText}>
            Importe un document Word, texte ou Markdown, ou dépose-le ici.
            <br />
            PDF, ePub et images arrivent dans les prochaines versions.
          </p>
          <Button variant="primary" onClick={pick}>
            <IconUpload size={20} />
            Choisir des fichiers
          </Button>
        </div>
      )}

      {docs.length > 0 && (
        <ul className={styles.grid} aria-label="Documents">
          {docs.map((d) => (
            <DocCard key={d.id} doc={d} />
          ))}
        </ul>
      )}
    </div>
  );
}
