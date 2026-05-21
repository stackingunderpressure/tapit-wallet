import { hexToBytes } from './hex.ts';
import { anchorProvider } from './anchorProvider.ts';
import { anchorQueue, type AnchorRow } from './anchorQueue.ts';

// Background lifecycle helper. On start, scans the queue once and
// attempts every queued/pending/failed row in parallel. While the
// app is open, repeats the scan every POLL_MS. When navigator.onLine
// flips to false the worker pauses; when it flips back to true it
// resumes immediately rather than waiting for the next interval.
//
// Failed rows get exponential backoff per processOne — see
// nextAttemptDelay. A row that fails N times will be skipped until
// last_attempt + min(5min × 2^N, 1hr) has elapsed. The worker still
// scans every POLL_MS but processOne returns early for rows that
// aren't due yet, so the calendar gets retries that scale to the
// outage's duration. The maximum retry interval is one hour so a
// calendar that comes back after a day-long outage still gets
// retried within an hour of the user reopening the app.

const POLL_MS = 5 * 60 * 1000;
const MAX_PARALLEL = 4;
const BACKOFF_MIN_MS = 5 * 60 * 1000;
const BACKOFF_MAX_MS = 60 * 60 * 1000;

function nextAttemptDue(row: AnchorRow): number {
  if (!row.last_attempt) return 0;
  if (row.state !== 'failed') return 0;
  const last = Date.parse(row.last_attempt);
  if (!Number.isFinite(last)) return 0;
  const delay = Math.min(BACKOFF_MIN_MS * 2 ** Math.max(0, row.attempts - 1), BACKOFF_MAX_MS);
  return last + delay;
}

export interface WorkerHandle {
  stop(): void;
  /** Force an immediate scan; resolves when the scan completes. */
  kick(): Promise<void>;
  /** Subscribe to per-row updates so UI can re-render. */
  subscribe(listener: (row: AnchorRow) => void): () => void;
}

export function startAnchorWorker(ownerId: string): WorkerHandle {
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  let scanInFlight: Promise<void> | null = null;
  const listeners = new Set<(row: AnchorRow) => void>();
  const provider = anchorProvider();

  function notify(row: AnchorRow) {
    for (const l of listeners) l(row);
  }

  async function processOne(row: AnchorRow): Promise<void> {
    if (row.state === 'confirmed') return;
    // Exponential backoff for failed rows. Queued and pending rows
    // are processed immediately on every scan; failed rows wait
    // until their next-attempt-time before retrying so a calendar
    // outage doesn't get hammered.
    const due = nextAttemptDue(row);
    if (due > Date.now()) return;
    const digest = hexToBytes(row.digestHex);
    try {
      let result;
      if (row.state === 'queued' || row.anchor === null) {
        result = await provider.stamp(digest);
      } else if (row.state === 'pending' || row.state === 'failed') {
        if (row.anchor.status === 'confirmed') {
          // Already confirmed on the snapshot — sync state and move on.
          const synced: AnchorRow = { ...row, state: 'confirmed' };
          await anchorQueue.upsert(ownerId, synced);
          notify(synced);
          return;
        }
        result = await provider.upgrade(digest, row.anchor.proof);
      } else {
        return;
      }
      const anchor = {
        provider: provider.name,
        digest: row.digestHex,
        proof: result.proof,
        status: result.status,
        stampedAt: row.anchor?.stampedAt ?? new Date().toISOString(),
        ...(result.confirmedAt ? { confirmedAt: result.confirmedAt } : {}),
        ...(result.btcHeight !== undefined ? { btcHeight: result.btcHeight } : {}),
      };
      const next: AnchorRow = {
        ...row,
        state: result.status === 'confirmed' ? 'confirmed' : 'pending',
        anchor,
        attempts: row.attempts + 1,
        last_attempt: new Date().toISOString(),
        last_error: null,
      };
      await anchorQueue.upsert(ownerId, next);
      notify(next);
    } catch (err) {
      const next: AnchorRow = {
        ...row,
        state: 'failed',
        attempts: row.attempts + 1,
        last_attempt: new Date().toISOString(),
        last_error: err instanceof Error ? err.message : 'unknown error',
      };
      await anchorQueue.upsert(ownerId, next);
      notify(next);
    }
  }

  async function scan(): Promise<void> {
    if (stopped) return;
    if (!navigator.onLine) return;
    const rows = await anchorQueue.pending(ownerId);
    for (let i = 0; i < rows.length; i += MAX_PARALLEL) {
      if (stopped) return;
      await Promise.all(rows.slice(i, i + MAX_PARALLEL).map(processOne));
    }
  }

  async function tick(): Promise<void> {
    if (scanInFlight) return scanInFlight;
    scanInFlight = scan().finally(() => {
      scanInFlight = null;
    });
    return scanInFlight;
  }

  function onOnline() {
    void tick();
  }

  window.addEventListener('online', onOnline);
  void tick();
  timer = setInterval(() => void tick(), POLL_MS);

  return {
    stop() {
      stopped = true;
      if (timer) clearInterval(timer);
      window.removeEventListener('online', onOnline);
      listeners.clear();
    },
    kick: () => tick(),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
