import { useEffect, useMemo, useRef, useState } from 'react';
import type { LivenessState } from 'tapit-attest';
import { useWallet } from '../wallet-core/useWallet.ts';
import { findVouchingCircleCandidates } from '../connections/findVouchingCircleCandidates.ts';
import {
  createLivenessStore,
  createTransportSendSignal,
  subscribeLivenessStore,
  type LivenessStore,
  type SubjectStatus,
} from './liveness.ts';

// LivenessPanel — the human surface for the green / no-report / red primitive.
// Written so a worried family member understands it without any crypto words.
//
// Plain-English mapping (no jargon shown to the user):
//   green     -> "Checked in"      (a fresh "I'm OK" from this person)
//   no-report -> "No word yet"     (silence — NOT good, NOT bad, just unknown)
//   red       -> "Asking for help" (someone they trust raised the alarm)
//
// The heartbeat button is gentle ("I'm OK — check me in"). Raising red is a
// duress alarm, so it is deliberate: a second confirm step before it fires.
//
// LIVE WIRING: the panel reuses the SAME Mycelium transport the encrypted
// inbox + chat ride (exposed by WalletProvider through WalletContext.transport).
// When the network is connected, the store's sendSignal is backed by the
// dedicated encrypted liveness channel (createTransportSendSignal) so a
// heartbeat or red flag actually travels to the circle, and a subscription
// (subscribeLivenessStore) folds inner-verified arrivals back in. When the
// network is off (locked / opted out / briefly unavailable) the store falls
// back to a no-op send and the panel still works fully on-device — the feature
// stays pause_safe / removal_safe and never breaks the app on a null transport.
// Relays only ever see ciphertext; the private key never leaves the Wallet.

// A short, friendly freshness window for the demo surface: a heartbeat counts
// as "checked in" for 24 hours. The verifier (this panel) owns the window, per
// the primitive's design — freshness is never baked into the signed signal.
const TTL_SECONDS = 24 * 60 * 60;

interface StatePresentation {
  label: string;
  detail: string;
  dot: string;
  box: string;
}

function present(state: LivenessState): StatePresentation {
  switch (state) {
    case 'green':
      return {
        label: 'Checked in',
        detail: 'A recent "I am OK" from this person.',
        dot: 'bg-emerald-500',
        box: 'border-emerald-200 bg-emerald-50 text-emerald-900',
      };
    case 'red':
      return {
        label: 'Asking for help',
        detail:
          'Someone this person trusts raised the alarm. Treat this seriously.',
        dot: 'bg-red-500',
        box: 'border-red-200 bg-red-50 text-red-900',
      };
    default:
      return {
        label: 'No word yet',
        detail:
          'No recent check-in. This is not good or bad on its own — just unknown.',
        dot: 'bg-amber-400',
        box: 'border-amber-200 bg-amber-50 text-amber-900',
      };
  }
}

function shortKey(key: string): string {
  if (key.length <= 12) return key;
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}

function relativeSince(iso: string, now: number): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return 'recently';
  const secs = Math.max(0, Math.floor((now - then) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function LivenessPanel() {
  const { wallet, transport, holdings } = useWallet();

  // People the operator already trusts — family-unit, recovery-cohort, and
  // handshake peers — so the circle can be filled with a tap instead of by
  // pasting a raw 64-hex key. Same substrate the vouching-circle and recovery
  // pickers use, matched on the stable genesis identity (wallet.identity, not
  // the active publicKey) so a key rotation never hides a known peer.
  const circleCandidates = useMemo(
    () => findVouchingCircleCandidates(holdings, wallet.identity),
    [holdings, wallet.identity],
  );

  // The live transport, held in a ref so the store's send seam always reads
  // the CURRENT transport even though the store itself is built once. This
  // matters for field testing: the operator may open this section before the
  // Mycelium network finishes connecting, or toggle it on in Settings while
  // the panel is open. The ref keeps the send path correct across that change
  // without rebuilding the store (which would drop accumulated circle state).
  const transportRef = useRef(transport);
  transportRef.current = transport;

  // One store per wallet, kept stable across renders. The send seam delegates
  // to whatever transport is currently live; createTransportSendSignal never
  // sees a private key (the signature is minted by the store through
  // wallet.signDigest before the seam is called). When no transport exists the
  // seam is a silent no-op and the panel works fully on-device.
  const storeRef = useRef<LivenessStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createLivenessStore({
      wallet,
      sendSignal: async (signal, recipients) => {
        const live = transportRef.current;
        if (!live) return;
        await createTransportSendSignal(live, wallet)(signal, recipients);
      },
    });
  }
  const store = storeRef.current;

  // Re-render on every store change. A version counter is enough here.
  const [, setVersion] = useState(0);
  useEffect(() => store.subscribe(() => setVersion((v) => v + 1)), [store]);

  // Live receive: when the Mycelium transport is connected, subscribe the
  // store to the encrypted liveness channel so inner-verified heartbeats and
  // red flags from the circle fold into state. Torn down on unmount or when
  // the transport reference changes (lock / opt-out / key rotation) — the
  // exact same lifecycle discipline the inbox + chat subscriptions use. A
  // null transport is a no-op: the panel simply stays on-device until the
  // network comes up.
  useEffect(() => {
    if (!transport) return;
    const sub = subscribeLivenessStore(transport, store, wallet);
    return () => sub.close();
  }, [transport, store, wallet]);

  // A 1-minute tick so the "last checked in" relative time and the gentle
  // nudge stay current without a heartbeat firing. Cheap; cleared on unmount.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The subject key currently pending a "raise red" confirm, or null.
  const [confirmRed, setConfirmRed] = useState<string | null>(null);
  // Free-text box for adding a circle member by their key.
  const [newMember, setNewMember] = useState('');

  // Read live state each render — the version counter (bumped by the store
  // subscription) is what forces the re-render, so these are always fresh.
  const groupState = store.getState();
  const myStatus = store.myStatus(TTL_SECONDS);
  const groupStatuses: SubjectStatus[] = store.groupStatuses(TTL_SECONDS);

  // Connections not already in the circle — the one-tap add options.
  const inCircle = new Set(groupState.group.map((k) => k.toLowerCase()));
  const candidateOptions = circleCandidates.filter(
    (c) => !inCircle.has(c.pubkey.toLowerCase()),
  );

  // Gentle proof-of-life nudge. Plain language, never alarming. Shown only
  // when the operator has checked in at least once AND it has been longer
  // than the freshness window (so a never-checked-in wallet sees the calm
  // first-time copy below the button, not a "you're overdue" prompt). The
  // 1-minute tick keeps this fresh while the panel is open.
  const lastCheckIn = groupState.myProofOfLife?.issuedAt ?? null;
  const lastCheckInLabel = lastCheckIn ? relativeSince(lastCheckIn, nowMs) : null;
  const checkInStale =
    lastCheckIn !== null &&
    nowMs - Date.parse(lastCheckIn) > TTL_SECONDS * 1000;

  async function heartbeat() {
    setError(null);
    setBusy(true);
    try {
      await store.sendHeartbeat();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check in.');
    } finally {
      setBusy(false);
    }
  }

  async function doRaiseRed(subject: string) {
    setError(null);
    setBusy(true);
    try {
      await store.raiseRed(subject);
      setConfirmRed(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not raise the alarm.');
    } finally {
      setBusy(false);
    }
  }

  // Add one key to the circle, validating its shape and de-duplicating.
  // Shared by the paste field and the one-tap "from your connections" options
  // so both paths enforce the same rules. Returns true when the circle now
  // contains the key (added, or already present), false on a bad key.
  function addToCircle(raw: string): boolean {
    const key = raw.trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(key)) {
      setError('That does not look like a person key (64 hex characters).');
      return false;
    }
    if (groupState.group.some((k) => k.toLowerCase() === key)) return true;
    store.setGroup([...groupState.group, key]);
    return true;
  }

  function addMember() {
    setError(null);
    if (addToCircle(newMember)) setNewMember('');
  }

  function removeMember(key: string) {
    store.setGroup(groupState.group.filter((k) => k !== key));
  }

  const mine = present(myStatus);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold">Are you OK?</h2>
        <p className="mt-1 text-sm text-muted">
          A quiet way to tell the people you trust that you are alright — and to
          see at a glance whether they are. Tap to check in. If you are ever in
          trouble, you can raise a quiet alarm.
        </p>
        <p className="mt-2 text-xs text-muted">
          {transport
            ? 'When you check in or raise an alarm, it travels to your circle over your network — encrypted, so only they can read it.'
            : 'Your network is off right now, so check-ins stay on this device. Turn on the network in Settings to share them with your circle.'}
        </p>
      </div>

      {/* Gentle proof-of-life nudge — calm, never alarming. */}
      {checkInStale && myStatus !== 'red' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
          <p className="text-sm font-medium">It&apos;s been a while.</p>
          <p className="mt-0.5 text-xs">
            Your last check-in was {lastCheckInLabel}. A quick tap lets the
            people you trust know you are alright — no rush.
          </p>
        </div>
      )}

      {/* My own state */}
      <div className={`rounded-xl border px-4 py-4 ${mine.box}`}>
        <div className="flex items-center gap-2">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${mine.dot}`} />
          <span className="text-sm font-semibold">You: {mine.label}</span>
        </div>
        <p className="mt-1 text-xs">{mine.detail}</p>
        {lastCheckInLabel && (
          <p className="mt-1 text-xs opacity-80">
            Last check-in: {lastCheckInLabel}.
          </p>
        )}
        <button
          type="button"
          onClick={heartbeat}
          disabled={busy}
          className="mt-3 w-full rounded-md bg-ink py-3 text-paper text-sm font-medium disabled:opacity-50"
        >
          I&apos;m OK — check me in
        </button>
        {myStatus !== 'red' && (
          <button
            type="button"
            onClick={() => setConfirmRed(wallet.publicKey)}
            disabled={busy}
            className="mt-2 w-full rounded-md border border-red-300 py-2 text-red-700 text-sm font-medium disabled:opacity-50"
          >
            I need help — raise my alarm
          </button>
        )}
      </div>

      {/* The circle */}
      <div>
        <h3 className="text-sm font-semibold">Your circle</h3>
        <p className="mt-1 text-xs text-muted">
          The people who can see your state and whose state you watch. Only
          someone in this circle can raise an alarm for you.
        </p>

        <div className="mt-3 space-y-2">
          {groupStatuses.length === 0 && (
            <p className="text-xs text-muted">
              {candidateOptions.length > 0
                ? 'No one added yet. Add someone you have connected with, or paste a key below.'
                : 'No one added yet. Add a trusted person by their key below.'}
            </p>
          )}
          {groupStatuses.map(({ subject, state }) => {
            const p = present(state);
            return (
              <div
                key={subject}
                className={`rounded-lg border px-3 py-3 ${p.box}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${p.dot}`}
                    />
                    <span className="text-sm font-medium truncate">
                      {shortKey(subject)}
                    </span>
                  </div>
                  <span className="text-xs font-semibold shrink-0">
                    {p.label}
                  </span>
                </div>
                <p className="mt-1 text-xs">{p.detail}</p>
                <div className="mt-2 flex gap-2">
                  {state !== 'red' && (
                    <button
                      type="button"
                      onClick={() => setConfirmRed(subject)}
                      disabled={busy}
                      className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 disabled:opacity-50"
                    >
                      Raise alarm for them
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeMember(subject)}
                    disabled={busy}
                    className="rounded-md border border-transparent px-3 py-1.5 text-xs font-medium text-muted hover:text-ink disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {candidateOptions.length > 0 && (
          <div className="mt-3">
            <div className="text-xs uppercase tracking-wide text-muted">
              From your connections
            </div>
            <ul className="mt-1.5 space-y-1">
              {candidateOptions.map((c) => (
                <li key={c.pubkey}>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      addToCircle(c.pubkey);
                    }}
                    className="w-full flex items-center justify-between gap-2 rounded-md border border-ink/15 bg-white px-3 py-2 text-left text-sm hover:bg-ink/5"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium truncate">{c.name}</span>
                      <span className="block text-xs text-muted font-mono">
                        {shortKey(c.pubkey)}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-accent">
                      Add
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-3">
          <div className="text-xs uppercase tracking-wide text-muted">
            {candidateOptions.length > 0
              ? "Or paste someone else's key"
              : 'Add by key'}
          </div>
          <div className="mt-1.5 flex gap-2">
            <input
              value={newMember}
              onChange={(e) => setNewMember(e.target.value)}
              placeholder="Trusted person's key (64 hex)"
              className="flex-1 rounded-md border border-ink/15 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={addMember}
              className="rounded-md bg-ink px-4 py-2 text-paper text-sm font-medium"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {/* Raise-red confirm — duress is deliberate, never one tap. */}
      {confirmRed && (
        <div className="fixed inset-0 z-50 bg-ink/40 flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-md bg-paper rounded-2xl p-5 shadow-xl">
            <h2 className="text-base font-semibold text-red-700">
              Raise a quiet alarm?
            </h2>
            <p className="mt-2 text-sm">
              {confirmRed === wallet.publicKey
                ? 'This tells your circle that you are in trouble. It is a serious signal — use it when you truly need help.'
                : `This tells the circle that ${shortKey(
                    confirmRed,
                  )} may be in trouble. Only raise it if you really believe something is wrong.`}
            </p>
            <p className="mt-2 text-xs text-muted">
              An alarm stays raised until a human clears it. It will not quietly
              time itself out.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => doRaiseRed(confirmRed)}
                disabled={busy}
                className="flex-1 rounded-md bg-red-600 py-3 text-white text-sm font-semibold disabled:opacity-50"
              >
                Yes, raise the alarm
              </button>
              <button
                type="button"
                onClick={() => setConfirmRed(null)}
                disabled={busy}
                className="flex-1 rounded-md border border-ink/15 py-3 text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
