import { useState } from 'react';

interface Props {
  /** The wallet's stable genesis pubkey — what other apps and peers recognize you by. Never changes across rotations. */
  identity: string;
  /** The currently-active signing key. Equals identity until the first rotation; diverges after. */
  activeKey: string;
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
export function IdentityCard({ identity, activeKey }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(identity);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const rotated = identity !== activeKey;
  const truncatedId = `${identity.slice(0, 8)}…${identity.slice(-8)}`;
  const truncatedActive = `${activeKey.slice(0, 8)}…${activeKey.slice(-8)}`;

  return (
    <div className="rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-muted">
        Your identity
      </div>
      <div className="mt-2 font-mono text-base">{truncatedId}</div>
      <button
        type="button"
        onClick={copy}
        className="mt-3 text-sm text-accent hover:underline"
      >
        {copied ? 'Copied' : 'Copy full key'}
      </button>
      {rotated && (
        <div className="mt-4 border-t border-ink/10 pt-3">
          <div className="text-xs uppercase tracking-wide text-muted">
            Currently signing with
          </div>
          <div className="mt-1 font-mono text-sm">{truncatedActive}</div>
          <p className="mt-1 text-xs text-muted">
            The succession chain in Settings → Rotate wallet key binds your
            previous key to this one. Verifiers walk it back to your
            identity automatically.
          </p>
        </div>
      )}
    </div>
  );
}
