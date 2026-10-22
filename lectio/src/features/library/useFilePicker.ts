// Ouvre le sélecteur de fichiers natif (import multiple).

import { useCallback } from 'react';
import { ACCEPT } from '../../core/import/detect';
import { useLibrary } from './store';

export function useFilePicker() {
  const importFiles = useLibrary((s) => s.importFiles);
  return useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = ACCEPT;
    input.onchange = () => {
      if (input.files) void importFiles(input.files);
    };
    input.click();
  }, [importFiles]);
}
