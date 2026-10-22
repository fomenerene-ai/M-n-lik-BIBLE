import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app/App';
import './ui/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Service worker : mise en cache de toute l'application pour le hors ligne.
// Désactivé en développement pour ne pas servir de vieux fichiers.
if (import.meta.env.PROD) registerSW({ immediate: true });
