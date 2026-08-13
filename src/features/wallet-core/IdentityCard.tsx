import { useState } from 'react';
import { IdentityChip } from '../connections/IdentityChip.tsx';

interface Props {
  /** The wallet's stable genesis pubkey — what other apps and peers recognize you by. Never changes across rotations. */
  identity: string;
  /** The currently-active signing key. Equals identity until the first rotation; diverges after. */
  activeKey: string;
  /** The operator's own display name from their identity attestation. Drives the
   *  IdentityChip's name + initials so the operator sees their own identity as
   *  a friendly chip rather than a wall of font-mono hex. Falls back to
   *  'You' when absent. */
  displayName?: string;
  /** Optional ISO birthday from the identity attestation. Renders as a leaf line when present. */
  birthday?: string;
  /** Optional free-text location from the identity attestation. */
  location?: string;
}

function formatBirthday(iso: string): string {
  // ISO YYYY-MM-DD → local-friendly display. Falls back to the raw
  // string if parsing fails so a malformed leaf doesn't render
  // "Invalid Date" — the wallet stays honest about what's stored.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// The single identity card on the home screen. Identity is the
// GENESIS pubkey — the stable identifier that does not change when
// the operator rotates their active signing key. The active key
// is shown separately when it differs from identity, so a rotated
// wallet honestly surfaces both facts: "this is who I am" plus
// "this is what I'm currently signing with." Pre-rotation the two
// are equal and only the identity row renders.
//
// Per DESIGN.md §10 Phase 1, the identity card with the pubkey
// displayed IS the proof that key generation worked. Phase 2 added
// the signed identity attestation. Phase 5e-vii's rotation UI made
// this distinction load-bearing because labeling the active key
// as "Your identity" after a rotation would be semantically wrong.
export function IdentityCard({ identity, activeKey, displayName, birthday, location }: Props) {
  const [copied, setCopied] = useState(false);
  const [activeCopied, setActiveCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(identity);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function copyActive() {
    await navigator.clipboard.writeText(activeKey);
    setActiveCopied(true);
    setTimeout(() => setActiveCopied(false), 1500);
  }

  const rotated = identity !== activeKey;

  return (
    <div className="rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-muted">
        Your identity
      </div>
      <div className="mt-2">
        <IdentityChip
          pubkey={identity}
          name={displayName || 'You'}
          size="lg"
        />
      </div>
      <button
        type="button"
        onClick={copy}
        className="mt-3 text-sm text-accent hover:underline"
      >
        {copied ? 'Copied' : 'Copy identity key'}
      </button>
      {rotated && (
        <p className="mt-1 text-xs text-muted">
          This is your stable identity, not what you're signing with right now — an app
          that wants to message or send something TO you (like a Bitcoin vault wanting you
          as a signer) needs your key from "Currently signing with" below instead.
        </p>
      )}
      {(birthday || location) && (
        <dl className="mt-3 space-y-1 text-sm">
          {birthday && (
            <div className="flex gap-2">
              <dt className="text-muted shrink-0">Birthday</dt>
              <dd>{formatBirthday(birthday)}</dd>
            </div>
          )}
          {location && (
            <div className="flex gap-2">
              <dt className="text-muted shrink-0">Location</dt>
              <dd>{location}</dd>
            </div>
          )}
        </dl>
      )}
      {rotated && (
        <div className="mt-4 border-t border-ink/10 pt-3">
          <div className="text-xs uppercase tracking-wide text-muted">
            Currently signing with
          </div>
          <div className="mt-2">
            <IdentityChip pubkey={activeKey} name={displayName || 'You'} size="md" />
          </div>
          <button
            type="button"
            onClick={copyActive}
            className="mt-2 text-sm text-accent hover:underline"
          >
            {activeCopied ? 'Copied' : 'Copy signing key'}
          </button>
          <p className="mt-2 text-xs text-muted">
            Give THIS key to an app that needs to encrypt something to you directly — an
            older, already-rotated-away-from key can't decrypt anything new, even though
            it's still part of your identity history. The succession chain in Settings →
            Rotate wallet key binds your previous key to this one; verifiers walk it back
            to your identity automatically.
          </p>
        </div>
      )}
    </div>
  );
}
