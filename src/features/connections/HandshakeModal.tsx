import { useState } from 'react';
import type { Attestation } from 'tapit-attest';
import { canonicalEnvelope } from 'tapit-attest';
import { useWallet } from '../wallet-core/useWallet.ts';
import { parseEnvelope } from '../cosigning/parseEnvelope.ts';
import { mergeSignatures } from '../cosigning/mergeSignatures.ts';
import { QrShow } from '../qr/QrShow.tsx';
import { QrScanModal } from '../qr/QrScanModal.tsx';
import {
  buildHandshakeDraft,
  displayNameOf,
  holdAndAnchor,
  isHandshake,
  readHandshake,
} from './createHandshake.ts';

interface Props {
  onClose: () => void;
}

// Phase 5a — the in-person handshake ceremony. Two wallets,
// physically together, produce ONE relationship attestation
// co-signed by both. Three QR transmissions:
//   1. the initiator shows their identity — the responder scans it
//   2. the responder builds + signs the handshake and shows it —
//      the initiator scans it and co-signs
//   3. the initiator shows the co-signed handshake — the responder
//      scans it
// Both wallets end holding the same co-signed Tier P connection.
// The co-signature is what makes "in person" honest: a record can
// carry both signatures only if both wallets actually took part.

type Step =
  | 'role'
  | 'i-show-identity'
  | 'i-preview'
  | 'i-show-cosigned'
  | 'r-ready'
  | 'r-preview'
  | 'r-show-handshake'
  | 'done';

const eyebrow = 'text-xs uppercase tracking-wide text-accent';
const primaryBtn =
  'w-full rounded-md bg-ink py-3 text-paper text-sm font-medium disabled:opacity-40';

export function HandshakeModal({ onClose }: Props) {
  const { wallet, ownerId, identity, anchorWorker, save } = useWallet();
  const [step, setStep] = useState<Step>('role');
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handshake, setHandshake] = useState<Attestation | null>(null);
  const [scannedIdentity, setScannedIdentity] = useState<Attestation | null>(
    null,
  );
  const [peerName, setPeerName] = useState('');

  function fail(err: unknown, fallback: string) {
    setError(err instanceof Error ? err.message : fallback);
    setBusy(false);
  }

  // Responder scanned the initiator's identity QR.
  function onScanIdentity(raw: string) {
    setScanning(false);
    setError(null);
    try {
      const att = parseEnvelope(raw);
      if (att.kind !== 'identity') {
        throw new Error(
          'That code is not an identity — ask them to show their identity code.',
        );
      }
      setScannedIdentity(att);
      setPeerName(displayNameOf(att));
      setStep('r-preview');
    } catch (err) {
      fail(err, 'Could not read that code.');
    }
  }

  // Responder builds + signs the handshake from both identities.
  async function buildAndSign() {
    if (!scannedIdentity) return;
    if (!identity) {
      setError('Your identity is not ready yet.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const draft = buildHandshakeDraft(scannedIdentity, identity);
      const signed = wallet.sign(draft);
      await holdAndAnchor(wallet, ownerId, anchorWorker, signed);
      await save();
      setHandshake(signed);
      setBusy(false);
      setStep('r-show-handshake');
    } catch (err) {
      fail(err, 'Could not build the handshake.');
    }
  }

  // Responder scanned the co-signed handshake coming back.
  async function onScanCosigned(raw: string) {
    setScanning(false);
    if (!handshake) return;
    setBusy(true);
    setError(null);
    try {
      const incoming = parseEnvelope(raw);
      const { merged } = mergeSignatures(handshake, incoming);
      await holdAndAnchor(wallet, ownerId, anchorWorker, merged);
      await save();
      setHandshake(merged);
      setBusy(false);
      setStep('done');
    } catch (err) {
      fail(err, 'Could not read the co-signed code.');
    }
  }

  // Initiator scanned the responder's signed handshake.
  function onScanHandshake(raw: string) {
    setScanning(false);
    setError(null);
    try {
      const att = parseEnvelope(raw);
      if (!isHandshake(att)) {
        throw new Error(
          'That code is not a handshake — ask them to show the handshake code.',
        );
      }
      const view = readHandshake(att);
      if (identity && view.initiatorId !== identity.subject) {
        throw new Error(
          'This handshake is not addressed to you. Start over so it names the right person.',
        );
      }
      setHandshake(att);
      setPeerName(view.responderName);
      setStep('i-preview');
    } catch (err) {
      fail(err, 'Could not read that code.');
    }
  }

  // Initiator co-signs the handshake.
  async function coSign() {
    if (!handshake) return;
    setBusy(true);
    setError(null);
    try {
      const cosigned = wallet.sign(handshake);
      await holdAndAnchor(wallet, ownerId, anchorWorker, cosigned);
      await save();
      setHandshake(cosigned);
      setBusy(false);
      setStep('i-show-cosigned');
    } catch (err) {
      fail(err, 'Could not co-sign the handshake.');
    }
  }

  function handleScan(raw: string) {
    if (step === 'i-show-identity') onScanHandshake(raw);
    else if (step === 'r-ready') onScanIdentity(raw);
    else if (step === 'r-show-handshake') onScanCosigned(raw);
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-paper rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">In-person handshake</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted hover:text-ink"
          >
            Close
          </button>
        </div>

        {step === 'role' && (
          <>
            <p className="mt-2 text-sm text-muted">
              A handshake connects two wallets that are physically
              together. One of you starts, the other joins — decide
              between you, then tap.
            </p>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => setStep('i-show-identity')}
                className={primaryBtn}
              >
                I'll start
              </button>
              <button
                type="button"
                onClick={() => setStep('r-ready')}
                className="w-full rounded-md border border-ink/15 py-3 text-sm font-medium"
              >
                I'll join
              </button>
            </div>
          </>
        )}

        {step === 'i-show-identity' && (
          <>
            <div className={`mt-2 ${eyebrow}`}>Step 1 of 3</div>
            <p className="mt-1 text-sm text-muted">
              Show this to the person you're connecting with. They scan
              it from their wallet.
            </p>
            {identity ? (
              <QrShow
                text={canonicalEnvelope(identity)}
                label="Your identity"
              />
            ) : (
              <p className="mt-3 text-sm text-red-600">
                Your identity isn't ready yet.
              </p>
            )}
            <button
              type="button"
              onClick={() => setScanning(true)}
              className={`mt-4 ${primaryBtn}`}
            >
              Next: scan their handshake code
            </button>
          </>
        )}

        {step === 'i-preview' && (
          <>
            <div className={`mt-2 ${eyebrow}`}>Step 2 of 3</div>
            <h3 className="mt-1 text-lg font-semibold">
              Connect with {peerName || 'this person'}?
            </h3>
            <p className="mt-1 text-sm text-muted">
              Co-signing records an in-person connection that both of
              you have signed. It's anchored to Bitcoin like every
              other entry.
            </p>
            <button
              type="button"
              onClick={coSign}
              disabled={busy}
              className={`mt-4 ${primaryBtn}`}
            >
              {busy ? 'Co-signing…' : 'Co-sign this handshake'}
            </button>
          </>
        )}

        {step === 'i-show-cosigned' && (
          <>
            <div className={`mt-2 ${eyebrow}`}>Step 3 of 3</div>
            <p className="mt-1 text-sm text-muted">
              Show this back to {peerName || 'them'} so their wallet
              gets the final, co-signed copy. Then you're done.
            </p>
            {handshake && (
              <QrShow
                text={canonicalEnvelope(handshake)}
                label="Co-signed handshake"
              />
            )}
            <button
              type="button"
              onClick={onClose}
              className={`mt-4 ${primaryBtn}`}
            >
              Done
            </button>
          </>
        )}

        {step === 'r-ready' && (
          <>
            <div className={`mt-2 ${eyebrow}`}>Step 1 of 3</div>
            <p className="mt-1 text-sm text-muted">
              Scan the identity code the other person is showing you on
              their wallet.
            </p>
            <button
              type="button"
              onClick={() => setScanning(true)}
              className={`mt-4 ${primaryBtn}`}
            >
              Scan their identity code
            </button>
          </>
        )}

        {step === 'r-preview' && (
          <>
            <div className={`mt-2 ${eyebrow}`}>Step 2 of 3</div>
            <h3 className="mt-1 text-lg font-semibold">
              {peerName || 'This person'} wants to connect
            </h3>
            <p className="mt-1 text-sm text-muted">
              This builds one in-person handshake record. You sign it
              now; they co-sign it next, and you both keep a copy.
            </p>
            <button
              type="button"
              onClick={buildAndSign}
              disabled={busy}
              className={`mt-4 ${primaryBtn}`}
            >
              {busy ? 'Signing…' : 'Build & sign the handshake'}
            </button>
          </>
        )}

        {step === 'r-show-handshake' && (
          <>
            <div className={`mt-2 ${eyebrow}`}>Step 3 of 3</div>
            <p className="mt-1 text-sm text-muted">
              Show this to {peerName || 'them'}. They scan it and
              co-sign, then show you their final code.
            </p>
            {handshake && (
              <QrShow
                text={canonicalEnvelope(handshake)}
                label="Your signed handshake"
              />
            )}
            <button
              type="button"
              onClick={() => setScanning(true)}
              disabled={busy}
              className={`mt-4 ${primaryBtn}`}
            >
              {busy ? 'Saving…' : 'Next: scan their co-signed code'}
            </button>
          </>
        )}

        {step === 'done' && (
          <div className="mt-3 text-center">
            <div className={eyebrow}>Connected</div>
            <h3 className="mt-1 text-lg font-semibold">
              You're connected with {peerName || 'them'}
            </h3>
            <p className="mt-1 text-sm text-muted">
              The handshake is signed by both of you, marked in person,
              and anchored. You'll find it under People.
            </p>
            <button
              type="button"
              onClick={onClose}
              className={`mt-4 ${primaryBtn}`}
            >
              Done
            </button>
          </div>
        )}

        {error && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
      {scanning && (
        <QrScanModal onScanned={handleScan} onClose={() => setScanning(false)} />
      )}
    </div>
  );
}
