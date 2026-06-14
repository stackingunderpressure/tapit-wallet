import type { Attestation, FieldBranch } from 'tapit-attest';

// "Moments" — the honestly-marked event date.
//
// A journal entry already carries `written_at` (when it was logged and
// signed) — that value is ALWAYS now and is never forged. A Moment adds
// an optional `event_date` leaf: the day the thing actually HAPPENED, set
// by the author. The two are kept deliberately separate so an older
// memory can be backfilled — the 25-year-old ball game, a photographed
// keepsake card, Grandma's story about 1945 — without ever lying about
// when it was recorded. The signature + anchor prove "this existed,
// unchanged, by the day it was logged"; the event_date is an honest claim
// "and it's about this earlier day," never a forged timestamp. Getting
// that boundary right is what keeps the whole trust model honest.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function readLeaf(att: Attestation, name: string): string | undefined {
  const claim = att.claim as FieldBranch;
  const child = claim.children.find((c) => c.name === name);
  if (child && child.node === 'leaf' && typeof child.value === 'string') {
    return child.value;
  }
  return undefined;
}

/**
 * The honestly-marked day the moment HAPPENED, if the author set one.
 * Distinct from written_at. Returns undefined when absent or unparseable.
 */
export function readEventDate(att: Attestation): string | undefined {
  const v = readLeaf(att, 'event_date');
  if (!v) return undefined;
  return Number.isNaN(Date.parse(v)) ? undefined : v;
}

/**
 * When the entry was logged and signed — the `written_at` leaf, falling
 * back to the envelope's issuedAt. Never the event_date; this is the
 * honest "when it was recorded" timestamp.
 */
export function readWrittenAt(att: Attestation): number {
  const w = readLeaf(att, 'written_at');
  if (w) {
    const t = Date.parse(w);
    if (!Number.isNaN(t)) return t;
  }
  return Date.parse(att.issuedAt);
}

/**
 * The timestamp a moment should be REMEMBERED by: the day it happened
 * when known, otherwise the day it was logged. Anniversary resurfacing
 * uses this so a backfilled memory surfaces on its real date, not on the
 * day it was typed in.
 */
export function momentTimestamp(att: Attestation): number {
  const ev = readEventDate(att);
  if (ev) {
    const t = Date.parse(ev);
    if (!Number.isNaN(t)) return t;
  }
  return readWrittenAt(att);
}

/**
 * True when the moment was recorded meaningfully AFTER it happened — an
 * older memory backfilled into the wallet (more than a day between the
 * event and the logging). Drives the honest "happened then, recorded
 * later" framing in the UI.
 */
export function isBackfilled(att: Attestation): boolean {
  const ev = readEventDate(att);
  if (!ev) return false;
  const evMs = Date.parse(ev);
  if (Number.isNaN(evMs)) return false;
  return readWrittenAt(att) - evMs > MS_PER_DAY;
}

/**
 * Normalize a date-input value (YYYY-MM-DD) into a storable event_date,
 * or undefined when empty/invalid. Future dates are rejected — a moment
 * you are recording has, by definition, already happened.
 */
export function normalizeEventDateInput(
  value: string,
  now: number = Date.now(),
): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const t = Date.parse(trimmed);
  if (Number.isNaN(t)) return undefined;
  if (t > now + MS_PER_DAY) return undefined;
  return trimmed;
}

/**
 * Display a stored event_date as a friendly day. Date-only strings
 * (YYYY-MM-DD) are rendered in local time without the UTC-midnight
 * off-by-one that `new Date('2009-06-15')` would otherwise cause.
 */
export function formatEventDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  const d = m
    ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    : new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
