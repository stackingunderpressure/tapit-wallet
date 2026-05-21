import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root not found in index.html');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register the service worker after the app mounts so we never block
// the first paint on the SW handshake. Production-only — in dev the
// SW would cache module URLs Vite expects to revalidate on every load.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('SW registration failed', err);
    });
  });
}
