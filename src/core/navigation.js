// Navigation continue entre chapitres et livres, sans coupure entre les Testaments.

import { BOOKS, getBook } from './books.js';

const LAST = BOOKS.length;

export function nextChapter(book, chapter) {
  const b = getBook(book);
  if (!b) return null;
  if (chapter < b.chapters) return { book, chapter: chapter + 1 };
  if (book < LAST) return { book: book + 1, chapter: 1 };
  return null;
}

export function prevChapter(book, chapter) {
  if (chapter > 1) return { book, chapter: chapter - 1 };
  if (book > 1) return { book: book - 1, chapter: getBook(book - 1).chapters };
  return null;
}

export function nextBook(book) {
  return book < LAST ? { book: book + 1, chapter: 1 } : null;
}

export function prevBook(book) {
  return book > 1 ? { book: book - 1, chapter: 1 } : null;
}
