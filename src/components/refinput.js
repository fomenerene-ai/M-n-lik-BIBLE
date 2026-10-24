// Champ de saisie de référence avec autocomplétion des noms de livres.
// Accessibilité : motif « combobox » (WAI-ARIA) ; flèche bas pour entrer dans la liste,
// flèches haut/bas pour la parcourir, Entrée pour choisir, Échap pour la fermer.

import { h } from '../ui.js';
import { suggestBooks } from '../core/reference.js';

let counter = 0;

export function createRefInput({ value = '', placeholder = 'Ex. : Jean 3:16-21', onSubmit, buttonLabel = 'Afficher' }) {
  const listId = `ref-suggest-${++counter}`;
  const input = h('input', {
    type: 'text',
    class: 'ref-input',
    placeholder,
    autocomplete: 'off',
    autocapitalize: 'words',
    spellcheck: 'false',
    enterkeyhint: 'go',
    role: 'combobox',
    'aria-autocomplete': 'list',
    'aria-expanded': 'false',
    'aria-controls': listId,
    'aria-label': 'Référence biblique',
  });
  input.value = value;
  const list = h('div', { class: 'suggest', role: 'listbox', id: listId, 'aria-label': 'Livres proposés', hidden: true });

  const setOpen = (open) => {
    list.hidden = !open;
    input.setAttribute('aria-expanded', open ? 'true' : 'false');
  };

  const choose = (name) => {
    input.value = name + ' ';
    setOpen(false);
    input.focus();
  };

  const update = () => {
    const sug = suggestBooks(input.value);
    list.replaceChildren(
      ...sug.map((b) =>
        h('button', { type: 'button', role: 'option', class: 'suggest-item', tabindex: '-1', onclick: () => choose(b.name) }, b.name),
      ),
    );
    setOpen(sug.length > 0);
  };
  input.addEventListener('input', update);

  const items = () => [...list.querySelectorAll('.suggest-item')];
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && !list.hidden) {
      e.preventDefault();
      items()[0]?.focus();
    } else if (e.key === 'Escape' && !list.hidden) {
      e.preventDefault();
      setOpen(false);
    }
  });
  list.addEventListener('keydown', (e) => {
    const all = items();
    const i = all.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      all[Math.min(i + 1, all.length - 1)]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (i <= 0) input.focus();
      else all[i - 1].focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      input.focus();
    }
  });

  const form = h(
    'form',
    {
      class: 'ref-form',
      role: 'search',
      onsubmit: (e) => {
        e.preventDefault();
        setOpen(false);
        onSubmit(input.value);
      },
    },
    h('div', { class: 'ref-field' }, input, list),
    h('button', { class: 'btn primary', type: 'submit' }, buttonLabel),
  );
  return { el: form, input };
}
