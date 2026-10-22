import { useEffect } from 'react';
import { useRoute } from './router';
import { Rail } from './Rail';
import { DropOverlay } from './DropOverlay';
import { Placeholder } from './Placeholder';
import { LibraryView } from '../features/library/LibraryView';
import { DuplicateDialog } from '../features/library/DuplicateDialog';
import { ReaderView } from '../features/reader/ReaderView';
import { useLibrary } from '../features/library/store';
import { Toasts } from '../ui/Toasts';
import styles from './App.module.css';

export function App() {
  const route = useRoute();
  const load = useLibrary((s) => s.load);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className={styles.app}>
      <Rail current={route} />
      <main className={styles.main} id="contenu">
        {route.name === 'library' && <LibraryView />}
        {route.name === 'reader' && <ReaderView key={route.docId} docId={route.docId} />}
        {route.name === 'search' && <Placeholder title="Recherche" phase={6} />}
        {route.name === 'annotations' && <Placeholder title="Mes annotations" phase={8} />}
        {route.name === 'settings' && <Placeholder title="Réglages" phase={2} />}
      </main>
      <DuplicateDialog />
      <DropOverlay />
      <Toasts />
    </div>
  );
}
