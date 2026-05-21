import { useState } from 'react';

interface Props {
  publicKey: string;
}

// The single card on the home screen in v1: shows the user's
// current public key as their identity. Per DESIGN.md §10 Phase 1,
// the empty identity card with the pubkey displayed IS the proof
// that key generation worked. Phase 2 adds display name and the
// first signed identity attestation; this card is the canvas.
export function IdentityCard({ publicKey }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(publicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const truncated = `${publicKey.slice(0, 8)}…${publicKey.slice(-8)}`;

  return (
    <div className="rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-muted">
        Your identity
      </div>
      <div className="mt-2 font-mono text-base">{truncated}</div>
      <button
        type="button"
        onClick={copy}
        className="mt-3 text-sm text-accent hover:underline"
      >
        {copied ? 'Copied' : 'Copy full key'}
      </button>
    </div>
  );
}
