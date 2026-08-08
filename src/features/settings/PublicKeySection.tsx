import { useState } from 'react';
import { QrShow } from '../qr/QrShow.tsx';

// Cut C1 (manual half) of docs/integration-phase2-vault-key-bridge.md in the
// DynastyTrust repo: a "give an app my public key" screen. Deliberately
// text + QR only, no passphrase gate -- a public key isn't a secret, and this
// wallet's identity key has no BIP32 derivation to complicate (see wallet.ts:
// one flat keypair, no chain code, no xpub). The deep-link automation
// (a new sign-request intent) is a later addition on top of this; this panel
// alone is already a complete, working handoff by hand -- copy or scan, paste
// into whatever app needs it.
export function PublicKeySection({ publicKey }: { publicKey: string }) {
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(publicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <section className="mt-4 rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
      <div className="font-medium">Your public key</div>
      <p className="mt-1 text-sm text-muted">
        Safe to share. Other apps -- like a Bitcoin vault that wants you as a
        signer -- use this to recognize you. On its own it doesn't prove who's
        asking or answering; that's what an app's own sign-in flow is for.
        Your private key never leaves this wallet, no matter what this is
        pasted into.
      </p>
      <div className="mt-3 rounded-md border border-ink/15 bg-paper px-3 py-2 font-mono text-xs break-all">
        {publicKey}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void copy()}
          className="rounded-md border border-ink/15 px-4 py-2 text-sm font-medium hover:bg-ink/5"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
        <button
          type="button"
          onClick={() => setShowQr((v) => !v)}
          className="rounded-md border border-ink/15 px-4 py-2 text-sm font-medium hover:bg-ink/5"
        >
          {showQr ? 'Hide QR' : 'Show QR'}
        </button>
      </div>
      {showQr && <QrShow text={publicKey} label="Scan into the requesting app" />}
    </section>
  );
}
