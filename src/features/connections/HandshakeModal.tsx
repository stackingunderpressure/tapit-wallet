import { useEffect, useState } from 'react';
import type { Attestation } from 'tapit-attest';
import { canonicalEnvelope } from 'tapit-attest';
import { useWallet } from '../wallet-core/useWallet.ts';
import { parseEnvelope } from '../cosigning/parseEnvelope.ts';
import { mergeSignatures } from '../cosigning/mergeSignatures.ts';
import { QrShow } from '../qr/QrShow.tsx';
import { QrScanModal } from '../qr/QrScanModal.tsx';
import {
  buildHandshakeDraft,
  buildRemoteHandshakeDraft,
  displayNameOf,
  holdAndAnchor,
  isHandshake,
  readHandshake,
} from './createHandshake.ts';
import { PeerPicker } from './PeerPicker.tsx';
import { extractPubkey } from './extractPubkey.ts';
import {
  summarizePublish,
  type PublishStatusSummary,
} from '../transport/publishStatus.ts';

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
  | 'remote-pick'
  | 'remote-sent'
  | 'done';

const eyebrow = 'text-xs uppercase tracking-wide text-accent';
const primaryBtn =
  'w-full rounded-md bg-ink py-3 text-paper text-sm font-medium disabled:opacity-40';

export function HandshakeModal({ onClose }: Props) {
  const { wallet, ownerId, holdings, identity, anchorWorker, prefs, sendEnvelope, save } = useWallet();
  const [step, setStep] = useState<Step>('role');
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handshake, setHandshake] = useState<Attestation | null>(null);
  const [scannedIdentity, setScannedIdentity] = useState<Attestation | null>(
    null,
  );
  const [peerName, setPeerName] = useState('');
  // Remote-handshake-start (Tier R) state.
  const [remotePubkey, setRemotePubkey] = useState('');
  const [remoteName, setRemoteName] = useState('');
  const [remoteSendStatus, setRemoteSendStatus] = useState<PublishStatusSummary | null>(null);

  function fail(err: unknown, fallback: string) {
    setError(err instanceof Error ? err.message : fallback);
    setBusy(false);
  }

  // Error messages are step-local. A scan failure on the responder
  // path ("paste is not valid JSON" from a non-Tapit QR) should not
  // still be sitting at the bottom of the page when the operator
  // backs out and starts over on the initiator path. Clear the
  // banner whenever the step changes; individual handlers still
  // set fresh errors from their own try/catch when they fail.
  useEffect(() => {
    setError(null);
  }, [step]);

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
    // "Do what I mean" pivot. If the operator pasted a raw 64-char
    // pubkey (not an envelope JSON) into any of the in-person scan
    // steps, their intent is to handshake with that person but they
    // only had the pubkey to hand — that's the remote-handshake
    // path. Pre-fill the remote pubkey state and switch the modal
    // to remote-pick instead of throwing 'paste is not valid JSON'
    // through the in-person scan parser. Envelope-shaped pastes
    // (anything that starts with '{') keep the existing per-step
    // routing because they're real handshake / identity envelopes.
    const trimmed = raw.trim();
    const cleanHex = trimmed.replace(/\s+/g, '').replace(/^0x/i, '').toLowerCase();
    const isJustPubkey =
      /^[0-9a-f]{64}$/i.test(cleanHex) && !trimmed.startsWith('{');
    if (isJustPubkey && identity && cleanHex !== identity.subject) {
      setRemotePubkey(cleanHex);
      setStep('remote-pick');
      return;
    }
    if (step === 'i-show-identity') onScanHandshake(raw);
    else if (step === 'r-ready') onScanIdentity(raw);
    else if (step === 'r-show-handshake') onScanCosigned(raw);
  }

  // Tier R — initiator builds + signs a remote handshake draft and
  // ships it to the responder via Nostr. The draft carries
  // verification='remote' (D-09); the responder's wallet will see a
  // 1-sig handshake in their inbox and auto-route it to
  // cosign-witness, where the existing Send-back-via-Nostr path
  // returns the dual-signed envelope. Both wallets end holding the
  // same Tier R record — labelled honestly weaker than Tier P.
  async function startRemoteHandshake() {
    if (!identity) {
      setError('Your identity is not ready yet.');
      return;
    }
    // extractPubkey is generous: accepts a raw 64-hex string with
    // any surrounding whitespace, OR a full identity envelope JSON
    // (it reads .subject out). The PeerPicker already runs the same
    // extraction on paste, but rerunning here is the belt-and-
    // suspenders move in case the value came from somewhere other
    // than the picker (e.g. a future programmatic prefill).
    const pubkey = extractPubkey(remotePubkey);
    if (!pubkey) {
      setError(
        "That doesn't look like a public key or an identity code — paste their 64-character key (Settings → Identity → Copy full key on their wallet) or the full identity JSON.",
      );
      return;
    }
    if (pubkey === identity.subject) {
      setError('That is your own public key.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const draft = buildRemoteHandshakeDraft(identity, {
        pubkey,
        name: remoteName.trim(),
      });
      const signed = wallet.sign(draft);
      await holdAndAnchor(wallet, ownerId, anchorWorker, signed);
      await save();
      const result = await sendEnvelope(pubkey, signed);
      setRemoteSendStatus(summarizePublish(result));
      setHandshake(signed);
      setPeerName(remoteName.trim());
      setStep('remote-sent');
    } catch (err) {
      fail(err, 'Could not start the remote handshake.');
    } finally {
      setBusy(false);
    }
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
              A handshake connects two wallets. In person is the strong
              tier — two phones, two scans. Remote is the honest weaker
              tier — same record, marked as such.
            </p>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => setStep('i-show-identity')}
                className={primaryBtn}
              >
                I'll start (in person)
              </button>
              <button
                type="button"
                onClick={() => setStep('r-ready')}
                className="w-full rounded-md border border-ink/15 py-3 text-sm font-medium"
              >
                I'll join (in person)
              </button>
              {prefs.nostrTransportEnabled && (
                <button
                  type="button"
                  onClick={() => setStep('remote-pick')}
                  className="w-full rounded-md border border-accent/40 bg-accent/5 py-3 text-sm font-medium text-accent"
                >
                  Start a remote handshake (Tier R)
                </button>
              )}
            </div>
          </>
        )}

        {step === 'remote-pick' && (
          <>
            <div className={`mt-2 ${eyebrow}`}>Remote handshake · Tier R</div>
            <p className="mt-1 text-sm text-muted">
              Pick a connection or paste a public key. They will see a
              handshake request in their inbox; once they sign, both of
              you hold a Tier R record — labelled remote, weaker than
              an in-person handshake.
            </p>
            <div className="mt-3">
              <PeerPicker
                holdings={holdings}
                myIdentity={identity?.subject ?? ''}
                value={remotePubkey}
                onChange={setRemotePubkey}
              />
            </div>
            <label className="mt-3 block text-sm">
              <span className="text-muted">Their name (optional)</span>
              <input
                type="text"
                value={remoteName}
                onChange={(e) => setRemoteName(e.target.value)}
                placeholder="What should the record say about them?"
                className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={startRemoteHandshake}
              disabled={busy || remotePubkey.trim().length === 0}
              className={`mt-4 ${primaryBtn}`}
            >
              {busy ? 'Sending…' : 'Send remote handshake'}
            </button>
          </>
        )}

        {step === 'remote-sent' && (
          <div className="mt-3 text-center">
            <div className={eyebrow}>Sent · Tier R</div>
            <h3 className="mt-1 text-lg font-semibold">
              Handshake sent to {peerName || 'them'}
            </h3>
            <p className="mt-1 text-sm text-muted">
              Your signed copy is held and anchored. Once they accept
              and counter-sign, your wallet will absorb their signature
              from your inbox.
            </p>
            {remoteSendStatus && (
              <p
                className={`mt-2 text-xs ${
                  remoteSendStatus.tone === 'ok'
                    ? 'text-emerald-800'
                    : remoteSendStatus.tone === 'fail'
                      ? 'text-red-700'
                      : 'text-muted'
                }`}
                role="status"
              >
                {remoteSendStatus.detail}
              </p>
            )}
            <button
              type="button"
              onClick={onClose}
              className={`mt-4 ${primaryBtn}`}
            >
              Done
            </button>
          </div>
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
