import { navigate } from '../../app/router';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { useLibrary } from './store';

export function DuplicateDialog() {
  const current = useLibrary((s) => s.duplicates[0]);
  const resolve = useLibrary((s) => s.resolveDuplicate);
  const choose = async (choice: 'open' | 'import' | 'cancel') => {
    const doc = await resolve(choice);
    if (doc) navigate({ name: 'reader', docId: doc.id });
  };
  return (
    <Dialog
      open={Boolean(current)}
      title="Document déjà présent"
      onClose={() => void choose('cancel')}
      actions={
        <>
          <Button onClick={() => void choose('cancel')}>Annuler</Button>
          <Button onClick={() => void choose('import')}>Importer quand même</Button>
          <Button variant="primary" onClick={() => void choose('open')}>
            Ouvrir l’existant
          </Button>
        </>
      }
    >
      {current && (
        <p>
          « {current.file.name} » est identique à « {current.existing.title} », déjà dans ton
          classeur.
        </p>
      )}
    </Dialog>
  );
}
