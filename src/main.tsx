import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { bootstrapDeviceTheme } from './features/theme/applyTheme.ts';
import './index.css';

// Paint the operator's last-applied theme before React mounts so
// the first frame already carries the right palette. Synchronous
// read from localStorage; no Classic-flash-then-Fresh-flicker on
// cold boot for returning operators.
bootstrapDeviceTheme();

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
