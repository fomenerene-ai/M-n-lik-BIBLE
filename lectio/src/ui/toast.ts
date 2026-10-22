// File de messages courts (succès, erreurs) affichés en bas de l'écran.

import { create } from 'zustand';

export type Toast = { id: number; kind: 'info' | 'error' | 'success'; text: string };

type ToastState = {
  toasts: Toast[];
  push: (kind: Toast['kind'], text: string) => void;
  dismiss: (id: number) => void;
};

let counter = 0;

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (kind, text) => {
    const id = ++counter;
    set({ toasts: [...get().toasts, { id, kind, text }] });
    // Les erreurs restent plus longtemps : elles disent quoi faire.
    setTimeout(() => get().dismiss(id), kind === 'error' ? 9000 : 4000);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export const toast = {
  info: (text: string) => useToasts.getState().push('info', text),
  success: (text: string) => useToasts.getState().push('success', text),
  error: (text: string) => useToasts.getState().push('error', text),
};
