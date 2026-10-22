// Navigation principale : rail vertical à gauche sur tablette, barre en bas sur téléphone
// (bascule en CSS uniquement).

import type { ReactNode } from 'react';
import { routeHref, type Route } from './router';
import { useLibrary } from '../features/library/store';
import { IconAnnotations, IconLibrary, IconReader, IconSearch, IconSettings } from '../ui/icons';
import styles from './Rail.module.css';

type Item = { route: Route; label: string; icon: ReactNode };

export function Rail({ current }: { current: Route }) {
  const lastOpened = useLibrary(
    (s) => s.docs.filter((d) => d.openedAt > 0).sort((a, b) => b.openedAt - a.openedAt)[0],
  );
  const readerRoute: Route = {
    name: 'reader',
    docId: current.name === 'reader' ? current.docId : (lastOpened?.id ?? null),
  };
  const items: Item[] = [
    { route: { name: 'library' }, label: 'Classeur', icon: <IconLibrary /> },
    { route: readerRoute, label: 'Lecture', icon: <IconReader /> },
    { route: { name: 'search' }, label: 'Recherche', icon: <IconSearch /> },
    { route: { name: 'annotations' }, label: 'Annotations', icon: <IconAnnotations /> },
    { route: { name: 'settings' }, label: 'Réglages', icon: <IconSettings /> },
  ];
  return (
    <nav className={styles.rail} aria-label="Navigation principale">
      {items.map((item) => {
        const active = item.route.name === current.name;
        return (
          <a
            key={item.label}
            href={routeHref(item.route)}
            className={styles.item}
            aria-current={active ? 'page' : undefined}
          >
            <span className={styles.icon}>{item.icon}</span>
            <span className={styles.label}>{item.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
