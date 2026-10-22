import { useEffect, useState } from 'react';
import type { Block, DocMeta } from '../../core/model';
import { getContent, getDoc, markOpened } from '../../core/storage/documents';
import { navigate } from '../../app/router';
import { IconButton } from '../../ui/Button';
import {
  IconBack,
  IconPlay,
  IconPrev,
  IconNext,
  IconSearch,
  IconToc,
  IconVoice,
} from '../../ui/icons';
import styles from './ReaderView.module.css';

type Loaded = { meta: DocMeta; blocks: Block[] };

function BlockView({ block, number }: { block: Block; number: number | null }) {
  const sentences = block.sentences.map((s) => (
    <span key={s.id} data-sid={s.id} className={styles.sentence}>
      {s.text}{' '}
    </span>
  ));
  if (block.kind === 'heading') {
    const level = Math.min(block.level ?? 1, 3);
    const Tag = level === 1 ? 'h2' : level === 2 ? 'h3' : 'h4';
    return (
      <Tag id={block.id} className={styles[`h${level}`]} lang={block.lang}>
        {sentences}
      </Tag>
    );
  }
  const cls =
    block.kind === 'quote'
      ? styles.quote
      : block.kind === 'list-item'
        ? styles.item
        : block.kind === 'caption'
          ? styles.caption
          : styles.para;
  return (
    <p id={block.id} className={cls} lang={block.lang}>
      {number !== null && (
        <sup className={styles.num} aria-hidden="true">
          {number}
        </sup>
      )}
      {sentences}
    </p>
  );
}

export function ReaderView({ docId }: { docId: string | null }) {
  const [state, setState] = useState<Loaded | 'missing' | null>(null);

  useEffect(() => {
    if (!docId) return;
    let alive = true;
    void (async () => {
      const [meta, content] = await Promise.all([getDoc(docId), getContent(docId)]);
      if (!alive) return;
      if (!meta || !content || meta.deletedAt) return setState('missing');
      setState({ meta, blocks: content.blocks });
      void markOpened(docId);
    })();
    return () => {
      alive = false;
    };
  }, [docId]);

  if (!docId || state === 'missing') {
    return (
      <div className={styles.placeholder}>
        <p>{docId ? 'Ce document n’existe plus.' : 'Aucun document ouvert.'}</p>
        <p className={styles.hint}>Choisis un document dans le classeur.</p>
      </div>
    );
  }
  if (!state) return <div className={styles.placeholder} aria-busy="true" />;

  let counter = 0;
  return (
    <div className={styles.reader}>
      <header className={styles.topbar}>
        <IconButton label="Retour au classeur" onClick={() => navigate({ name: 'library' })}>
          <IconBack />
        </IconButton>
        <div className={styles.toolbar} role="toolbar" aria-label="Outils de lecture">
          <IconButton label="Table des matières" disabled={state.meta.toc.length === 0}>
            <IconToc />
          </IconButton>
          <IconButton label="Voix">
            <IconVoice />
          </IconButton>
          <IconButton label="Rechercher dans le document">
            <IconSearch />
          </IconButton>
          <span className={styles.langBadge} title="Langue de lecture">
            {state.meta.langMode === 'auto' ? 'AUTO' : state.meta.langMode.toUpperCase()}
          </span>
        </div>
      </header>

      <article className={styles.text} lang={state.meta.langMain}>
        <h1 className={styles.docTitle}>{state.meta.title}</h1>
        {state.meta.author && <p className={styles.docAuthor}>{state.meta.author}</p>}
        {state.blocks.map((b) => (
          <BlockView key={b.id} block={b} number={b.kind === 'heading' ? null : ++counter} />
        ))}
      </article>

      <div className={styles.player} aria-label="Lecteur">
        <button className={styles.playBtn} aria-label="Lire (disponible à la phase 2)" disabled>
          <IconPlay size={28} />
        </button>
        <div className={styles.pill}>
          <IconButton label="Page précédente" disabled>
            <IconPrev />
          </IconButton>
          <div className={styles.pillText}>
            <span className={styles.pillTitle}>{state.meta.title}</span>
            <span className={styles.pillPos}>{counter} paragraphes</span>
          </div>
          <IconButton label="Page suivante" disabled>
            <IconNext />
          </IconButton>
        </div>
      </div>
    </div>
  );
}
