import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Single build-version stamp, evaluated once when this config module
// loads so the SAME value is baked into the JS bundle (via `define`
// below) AND written to /version.json (via the plugin). The running
// app compares its baked-in __APP_VERSION__ against a periodic fetch of
// /version.json; a mismatch means a newer build is deployed and the
// update banner appears. Date.now() is monotonic enough for "is this a
// different build than the one I'm running" — the only question the
// checker asks.
const APP_VERSION = String(Date.now());

// Emit /version.json into the build output carrying APP_VERSION. Tiny
// hand-rolled plugin — no extra dep — mirroring the hand-rolled SW
// philosophy. Only runs in `vite build`; in dev the fetch 404s and the
// checker stays quiet (it's PROD-gated anyway).
function versionManifestPlugin(): Plugin {
  return {
    name: 'version-manifest',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version: APP_VERSION }),
      });
    },
  };
}

// Cheap/fast shell rules of thumb in here:
//   - Manual chunks separate the auth bundle from the wallet bundle so
//     the login screen ships without IndexedDB / tapit-attest weight.
//   - target esnext for smallest output; the browser support floor is
//     PWA-installable browsers, all evergreen.
//   - sourcemaps in dev only.
export default defineConfig({
  plugins: [react(), versionManifestPlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  build: {
    target: 'esnext',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          attest: ['tapit-attest'],
          // qrcode is a heavy single-purpose library; pin it to its
          // own deterministic chunk so the filename stays stable for
          // the bundle-budget check — otherwise Rollup renames the
          // shared chunk whenever its co-located modules change.
          qrcode: ['qrcode'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
