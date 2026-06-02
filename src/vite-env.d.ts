/// <reference types="vite/client" />

// Build-time version stamp injected by vite.config.ts `define`. Baked
// into the JS bundle at build; the update checker compares it against a
// fetched /version.json to detect a newer deploy. In dev this is the
// dev-server's load-time value; the checker is PROD-gated so it doesn't
// matter there.
declare const __APP_VERSION__: string;
