import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Cheap/fast shell rules of thumb in here:
//   - Manual chunks separate the auth bundle from the wallet bundle so
//     the login screen ships without IndexedDB / tapit-attest weight.
//   - target esnext for smallest output; the browser support floor is
//     PWA-installable browsers, all evergreen.
//   - sourcemaps in dev only.
export default defineConfig({
  plugins: [react()],
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
