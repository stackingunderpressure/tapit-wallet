import {
  OpenTimestampsProvider,
  type OtsProvider,
  type OtsTransport,
} from 'tapit-attest';

// Wrap the default fetch transport with a 30-second per-request
// AbortController timeout so a slow or hanging calendar can't pile
// up forever in the worker's scan. tapit-attest's
// OpenTimestampsProvider accepts a custom transport via its
// constructor; we use that injection point rather than touching
// library internals.
const REQUEST_TIMEOUT_MS = 30_000;

export function withoutContentType(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(headers).filter(([k]) => k.toLowerCase() !== 'content-type'));
}

function timeoutTransport(): OtsTransport {
  return async (url, init) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: init.method,
        // No Content-Type: application/octet-stream makes the browser send a
        // CORS pre-check (OPTIONS), which the calendar answers with 404, so
        // the stamp was blocked before it left the browser. A plain POST
        // gets Access-Control-Allow-Origin: * and the calendar reads the raw
        // body the same (checked with curl, 2026-11-27, found from the Family
        // Bitcoin Game, which shares this calendar).
        headers: withoutContentType(init.headers),
        // Uint8Array is accepted by fetch at runtime; lib.dom in
        // newer TS versions narrows BodyInit and excludes it.
        body: init.body as BodyInit | undefined,
        signal: controller.signal,
      });
      return {
        ok: res.ok,
        status: res.status,
        bytes: async () => new Uint8Array(await res.arrayBuffer()),
      };
    } finally {
      clearTimeout(timer);
    }
  };
}

let cached: OtsProvider | null = null;

export function anchorProvider(): OtsProvider {
  if (!cached) {
    cached = new OpenTimestampsProvider({ transport: timeoutTransport() });
  }
  return cached;
}
