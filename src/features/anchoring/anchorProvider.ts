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

function timeoutTransport(): OtsTransport {
  return async (url, init) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: init.method,
        headers: init.headers,
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
