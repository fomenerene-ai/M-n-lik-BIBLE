// Champ de saisie de référence avec autocomplétion des noms de livres.

import { h } from '../ui.js';
import { suggestBooks } from '../core/reference.js';

export function createRefInput({ value = '', placeholder = 'Ex. : Jean 3:16-21', onSubmit, buttonLabel = 'Afficher' }) {
  const input = h('input', {
    type: 'text',
    class: 'ref-input',
    placeholder,
    autocomplete: 'off',
    autocapitalize: 'words',
    spellcheck: 'false',
    enterkeyhint: 'go',
    'aria-label': 'Référence biblique',
  });
  input.value = value;
  const list = h('div', { class: 'suggest', role: 'listbox', hidden: true });

  const update = () => {
    const sug = suggestBooks(input.value);
    list.hidden = sug.length === 0;
    list.replaceChildren(
      ...sug.map((b) =>
        h(
          'button',
          {
            type: 'button',
            role: 'option',
            class: 'suggest-item',
            onclick: () => {
              input.value = b.name + ' ';
              list.hidden = true;
              input.focus();
            },
          },
          b.name,
        ),
      ),
    );
  };
  input.addEventListener('input', update);

  const form = h(
    'form',
    {
      class: 'ref-form',
      onsubmit: (e) => {
        e.preventDefault();
        list.hidden = true;
        onSubmit(input.value);
      },
    },
    h('div', { class: 'ref-field' }, input, list),
    h('button', { class: 'btn primary', type: 'submit' }, buttonLabel),
  );
  return { el: form, input };
}
