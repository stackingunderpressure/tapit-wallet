import {
  announcementOutbox,
  type AnnouncementOutboxRow,
} from './announcementOutbox.ts';

// Background retry loop for pending key-succession announcements (peer-
// rotation fix CUT 3). Mirrors anchorWorker.ts's poll + backoff +
// online-resume shape: on start it scans the queue once and attempts
// every pending row in parallel, repeats the scan every POLL_MS while
// the app is open, pauses when navigator.onLine is false, and resumes
// immediately when it flips back to true.
//
// This is the AUTOMATIC half of "reconcile after a key rotation": a
// row is retried with exponential backoff -- capped at one hour so a
// day-long outage still recovers within an hour of the app reopening
// -- until the addressed peer sends back a verified ack and
// announcementOutbox.markReceived flips it to 'received'. There is no
// attempt cap and no expiry; the announcement stays queued until
// received, matching the operator's ask directly. The MANUAL half --
// "reconnect now" -- is RotateKeySection's "Tell my connections my
// current key" button, which enqueues fresh rows and calls kick() for
// an immediate attempt rather than waiting for the next scheduled scan.

const POLL_MS = 5 * 60 * 1000;
const MAX_PARALLEL = 4;
const BACKOFF_MIN_MS = 5 * 60 * 1000;
const BACKOFF_MAX_MS = 60 * 60 * 1000;

function nextAttemptDue(row: AnnouncementOutboxRow): number {
  if (row.attempts === 0 || !row.last_attempt) return 0;
  const last = Date.parse(row.last_attempt);
  if (!Number.isFinite(last)) return 0;
  const delay = Math.min(
    BACKOFF_MIN_MS * 2 ** Math.max(0, row.attempts - 1),
    BACKOFF_MAX_MS,
  );
  return last + delay;
}

export interface AnnouncementWorkerHandle {
  stop(): void;
  /** Force an immediate scan; resolves when the scan completes. */
  kick(): Promise<void>;
  /** Subscribe to per-row updates so UI can re-render. */
  subscribe(listener: (row: AnnouncementOutboxRow) => void): () => void;
}

export function startAnnouncementOutboxWorker(
  ownerId: string,
  send: (peer: string, envelope: AnnouncementOutboxRow['envelope']) => Promise<unknown>,
): AnnouncementWorkerHandle {
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  let scanInFlight: Promise<void> | null = null;
  const listeners = new Set<(row: AnnouncementOutboxRow) => void>();

  function notify(row: AnnouncementOutboxRow) {
    for (const l of listeners) l(row);
  }

  async function processOne(row: AnnouncementOutboxRow): Promise<void> {
    if (row.state === 'received') return;
    if (nextAttemptDue(row) > Date.now()) return;
    try {
      await send(row.peer, row.envelope);
      const next: AnnouncementOutboxRow = {
        ...row,
        attempts: row.attempts + 1,
        last_attempt: new Date().toISOString(),
        last_error: null,
      };
      await announcementOutbox.upsert(ownerId, next);
      notify(next);
    } catch (err) {
      const next: AnnouncementOutboxRow = {
        ...row,
        attempts: row.attempts + 1,
        last_attempt: new Date().toISOString(),
        last_error: err instanceof Error ? err.message : 'send failed',
      };
      await announcementOutbox.upsert(ownerId, next);
      notify(next);
    }
  }

  async function scan(): Promise<void> {
    if (stopped) return;
    if (!navigator.onLine) return;
    const rows = await announcementOutbox.pending(ownerId);
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
