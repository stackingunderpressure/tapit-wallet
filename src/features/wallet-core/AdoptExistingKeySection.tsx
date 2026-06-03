import { useMemo, useState } from 'react';
import type { Wallet } from 'tapit-attest';
import { parseNostrPrivateKey } from './parseNostrPrivateKey.ts';
import { publicKeyFromPrivate } from 'tapit-attest';
import { useWallet } from './useWallet.ts';

interface Props {
  wallet: Wallet;
}

function shortKey(s: string): string {
  if (s.length <= 14) return s;
  return `${s.slice(0, 10)}…${s.slice(-4)}`;
}

// "Switch to my existing Nostr key" surface (operator request
// 2026-06-03). Sits in Settings beneath Rotate. Where Rotate sends the
// active key to a freshly-generated random key, this sends it to a key
// the operator PASTES — their old nsec from Primal / Damus / Amethyst —
// so the wallet keeps its identity and all its holdings but starts
// publishing under the operator's old npub again. The cryptographic work
// (succession link current->old, rebuild, K_data-preserving persist)
// lives in adoptExistingKey via the provider's adoptKey callback; this
// component is the paste + confirm + honest-disclosure UX.
//
// Three steps mirror the import flow: paste the key with a live-derived
// pubkey so the operator verifies the destination identity BEFORE
// committing, then a hard acknowledgement panel naming the real
// consequences, then the swap. The acknowledgement is required because
// the switch is forward-only and changes which identity the wallet
// signs as.
export function AdoptExistingKeySection({ wallet }: Props) {
  const { adoptKey } = useWallet();
  const [step, setStep] = useState<'idle' | 'enter' | 'confirm'>('idle');
  const [keyInput, setKeyInput] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneNpub, setDoneNpub] = useState<string | null>(null);

  const activeKey = wallet.publicKey;

  // Live-derive the destination pubkey from the pasted key so the
  // operator sees exactly which identity they're about to adopt.
  const livePubkey = useMemo(() => {
    if (keyInput.trim().length === 0) return null;
    const parsed = parseNostrPrivateKey(keyInput);
    if (!parsed.ok) return null;
    try {
      return publicKeyFromPrivate(parsed.privateKeyHex);
    } catch {
      return null;
    }
  }, [keyInput]);

  function onEnterContinue(e: React.FormEvent) {
    e.preventDefault();
    setParseError(null);
    const parsed = parseNostrPrivateKey(keyInput);
    if (!parsed.ok) {
      setParseError(parsed.reason);
      return;
    }
    if (publicKeyFromPrivate(parsed.privateKeyHex) === activeKey) {
      setParseError('That key is already this wallet\'s active key.');
      return;
    }
    setStep('confirm');
  }

  async function doAdopt() {
    setBusy(true);
    setError(null);
    try {
      const parsed = parseNostrPrivateKey(keyInput);
      if (!parsed.ok) throw new Error(parsed.reason);
      const result = await adoptKey(parsed.privateKeyHex);
      setDoneNpub(result.adoptedPublicKey);
      setStep('idle');
      setKeyInput('');
      setAcknowledged(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Switch failed.');
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setStep('idle');
    setKeyInput('');
    setParseError(null);
    setAcknowledged(false);
    setError(null);
  }

  return (
    <section className="mt-4 rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
      <div className="font-medium">Switch to my existing Nostr key</div>
      <p className="mt-1 text-sm text-muted">
        Already have a Nostr account you used elsewhere — Primal, Damus,
        Amethyst? Bring that identity in as this wallet's signing key. Your
        wallet keeps everything it already holds; from here on it publishes
        under your old account, so your existing profile, follows, and
        history are yours again. This uses the same succession chain as
        rotation, so nothing you've signed is lost.
      </p>

      <div className="mt-3 rounded-md border border-ink/10 bg-paper/50 p-3 text-xs">
        <span className="text-muted">Active signing key now:</span>{' '}
        <span className="font-mono">{shortKey(activeKey)}</span>
      </div>

      {doneNpub && (
        <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Done. Your wallet now signs as{' '}
          <span className="font-mono">{shortKey(doneNpub)}</span>. New Nostr
          posts and your profile will appear under that account. Your old
          key here was retired into the succession chain; your identity and
          holdings are unchanged.
        </div>
      )}

      {step === 'idle' && (
        <button
          type="button"
          onClick={() => {
            setStep('enter');
            setDoneNpub(null);
          }}
          className="mt-3 rounded-md border border-ink/15 px-4 py-2 text-sm font-medium hover:bg-ink/5"
        >
          Switch to an existing key
        </button>
      )}

      {step === 'enter' && (
        <form onSubmit={onEnterContinue} className="mt-4">
          <label className="block">
            <span className="text-sm font-medium">Your existing account key</span>
            <input
              type="text"
              required
              autoFocus
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="nsec1… or a 64-character hex private key"
              className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-xs font-mono focus:border-accent focus:outline-none"
            />
          </label>
          {livePubkey && (
            <div className="mt-3 rounded-md bg-ink/[0.04] px-3 py-2 text-xs">
              <div className="text-muted">You will start signing as:</div>
              <div className="mt-1 font-mono break-all text-ink">{livePubkey}</div>
              <div className="mt-1 text-muted">
                Check this is the account you meant to switch to.
              </div>
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={!livePubkey}
              className="rounded-md bg-ink py-2 px-4 text-paper text-sm font-medium disabled:opacity-40"
            >
              Continue
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-ink/15 px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
          {parseError && (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {parseError}
            </p>
          )}
        </form>
      )}

      {step === 'confirm' && (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4">
          <div className="text-sm font-semibold text-ink">
            Before you switch
          </div>
          <div className="mt-2 rounded bg-white/60 px-3 py-2 text-xs">
            <span className="text-muted">Switching to:</span>{' '}
            <span className="font-mono">
              {livePubkey ? shortKey(livePubkey) : '—'}
            </span>
          </div>
          <ul className="mt-3 list-disc pl-5 text-sm text-ink/80 space-y-1">
            <li>
              Your wallet identity and everything you've already signed stay
              exactly as they are — nothing is lost. The succession chain
              records that your current key handed off to this one.
            </li>
            <li>
              From now on your Nostr profile and posts appear under the key
              you're switching to. People who follow that account see you
              again; people who knew your current key here may need to
              reconnect.
            </li>
            <li>
              This key already exists in whatever app you used it in, so two
              copies of it exist — an encrypted one here and the original
              there. That's a little less private than a key made only here.
            </li>
            <li>
              The switch is forward-only. You can switch again later, but
              your current key stops being the active signing key the moment
              you confirm.
            </li>
          </ul>
          <label className="mt-3 flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I understand, and I want this wallet to sign as that key from
              now on.
            </span>
          </label>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void doAdopt()}
              disabled={!acknowledged || busy}
              className="rounded-md bg-ink py-2 text-paper text-sm font-medium disabled:opacity-40"
            >
              {busy ? 'Switching…' : 'Switch now'}
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={busy}
              className="rounded-md border border-ink/15 bg-white py-2 text-sm disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
          {error && (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
