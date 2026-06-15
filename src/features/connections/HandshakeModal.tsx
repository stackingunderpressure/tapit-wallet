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
import { RelationshipChips } from './RelationshipChips.tsx';
import { relationshipLabel } from './relationshipOptions.ts';
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
  | 'start'
  | 'i-preview'
  | 'i-show-cosigned'
  | 'r-ready'
  | 'r-preview'
  | 'r-show-handshake'
  | 'remote-sent'
  | 'done';

const eyebrow = 'text-xs uppercase tracking-wide text-accent';
const primaryBtn =
  'w-full rounded-md bg-ink py-3 text-paper text-sm font-medium disabled:opacity-40 transition active:animate-fresh-press motion-reduce:active:animate-none';

export function HandshakeModal({ onClose }: Props) {
  const { wallet, ownerId, holdings, identity, anchorWorker, prefs, sendEnvelope, save, relayStatus } = useWallet();
  // Whether the connection can finish over Nostr right now (transport on
  // AND at least one relay open). Drives the low-friction "scan once,
  // finish over Nostr" default on the scan path.
  const canFinishOverNostr =
    prefs.nostrTransportEnabled && (relayStatus ?? []).some((s) => s.open);
  const [step, setStep] = useState<Step>('role');
  const [scanning, setScanning] = useState(false);
  // Track which entry point opened the scan modal so QrScanModal
  // can skip the camera spin-up when the operator explicitly chose
  // the paste-first path. Operator field-test feedback: "if the
  // camera doesn't work, it needs to fall back to copy and paste
  // the text, easy, easy button and easy transfer." The paste-first
  // button on the "If they're with you" panel sets this to 'paste'.
  const [scanInitialMode, setScanInitialMode] = useState<'camera' | 'paste'>(
    'camera',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handshake, setHandshake] = useState<Attestation | null>(null);
  const [scannedIdentity, setScannedIdentity] = useState<Attestation | null>(
    null,
  );
  const [peerName, setPeerName] = useState('');
  // Optional relationship label the builder picks before signing.
  // Empty string = no label. The leaf is omitted from the envelope
  // when empty so older verifiers see no new field.
  const [relationship, setRelationship] = useState('');
  // Remote-handshake-start (Tier R) state.
  const [remotePubkey, setRemotePubkey] = useState('');
  const [remoteName, setRemoteName] = useState('');
  const [remoteSendStatus, setRemoteSendStatus] = useState<PublishStatusSummary | null>(null);
  // Which accordion panel of the unified Start page is expanded.
  // Smart default: open the 'not-here' panel if a pubkey is
  // already present (e.g. the operator was pivoted here from the
  // raw-pubkey-paste sniffer), else default to 'with-you'.
  const [openPanel, setOpenPanel] = useState<'with-you' | 'not-here'>('with-you');
  // Transient "Copied" feedback for the copy-my-code button under the QR.
  const [identityCopied, setIdentityCopied] = useState(false);
  // Self-attested "we met in person" on the scan-once-then-Nostr path.
  // Default true because you literally just scanned their code face to
  // face; it's your claim, surfaced honestly (not cryptographic proof).
  const [metInPerson, setMetInPerson] = useState(true);

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

  // When the operator arrives on 'start' with a pubkey already
  // filled (handleScan pivot, returning to the page, etc.), open
  // the remote panel so they see their work. Otherwise leave the
  // panel state alone so manual toggles are sticky.
  useEffect(() => {
    if (step === 'start' && remotePubkey.trim().length > 0) {
      setOpenPanel('not-here');
    }
  }, [step, remotePubkey]);

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
      const draft = buildHandshakeDraft(scannedIdentity, identity, relationship);
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

  // Scan-once-then-Nostr finish (the low-friction default). You scanned
  // their identity in person; instead of the 3-QR back-and-forth, build a
  // 1-sig connection to their pubkey and ship it over Nostr. Their wallet
  // auto-cosigns from its inbox (routeFor: 1-sig handshake → cosign-
  // witness) and the confirmed copy comes back to your inbox on its own.
  // verification='remote' (honest — the cosignature arrives over the
  // network), plus the self-attested met_in_person claim when ticked.
  async function sendScannedOverNostr() {
    if (!scannedIdentity || !identity) return;
    setBusy(true);
    setError(null);
    try {
      const draft = buildRemoteHandshakeDraft(
        identity,
        { pubkey: scannedIdentity.subject, name: peerName.trim() },
        relationship,
        undefined,
        metInPerson,
      );
      const signed = wallet.sign(draft);
      await holdAndAnchor(wallet, ownerId, anchorWorker, signed);
      await save();
      const result = await sendEnvelope(scannedIdentity.subject, signed);
      setRemoteSendStatus(summarizePublish(result));
      setHandshake(signed);
      setStep('remote-sent');
    } catch (err) {
      fail(err, 'Could not send the connection.');
    } finally {
      setBusy(false);
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
      fail(err, 'Could not read the confirmed code.');
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
      fail(err, 'Could not confirm the connection.');
    }
  }

  function handleScan(raw: string) {
    // "Do what I mean" pivot. A pasted raw 64-char pubkey (not an
    // envelope JSON) is the remote-handshake input — pre-fill the
    // PeerPicker's value and land back on the unified Start page
    // so the operator can confirm + send. Envelope-shaped pastes
    // (anything starting with '{') flow through the existing per-
    // step parsers because they are real handshake / identity
    // envelopes.
    const trimmed = raw.trim();
    const cleanHex = trimmed.replace(/\s+/g, '').replace(/^0x/i, '').toLowerCase();
    const isJustPubkey =
      /^[0-9a-f]{64}$/i.test(cleanHex) && !trimmed.startsWith('{');
    if (isJustPubkey && identity && cleanHex !== identity.subject) {
      setRemotePubkey(cleanHex);
      setStep('start');
      return;
    }
    if (step === 'start') onScanHandshake(raw);
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
      const draft = buildRemoteHandshakeDraft(
        identity,
        { pubkey, name: remoteName.trim() },
        relationship,
      );
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
      <div className="w-full max-w-md bg-paper rounded-2xl p-5 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Connect with someone</h2>
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
              A connection is a shared record that you two know each other —
              you each keep a copy, locked to Bitcoin's clock. To do it in
              person, one of you shows a code and the other scans it. It
              doesn't matter who goes first.
            </p>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setOpenPanel('with-you');
                  setStep('start');
                }}
                className={primaryBtn}
              >
                Show my code
              </button>
              <button
                type="button"
                onClick={() => setStep('r-ready')}
                className="w-full rounded-md border border-ink/15 py-3 text-sm font-medium"
              >
                Scan their code
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpenPanel('not-here');
                  setStep('start');
                }}
                className="w-full rounded-md border border-ink/15 py-3 text-sm font-medium"
              >
                They're not with me
              </button>
            </div>
          </>
        )}

        {step === 'start' && openPanel === 'with-you' && (
          <div className="mt-3">
            <div className={`${eyebrow}`}>In person · Step 1 of 3</div>
            <h3 className="mt-1 text-lg font-semibold">Show them this code</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
              <li>The other person opens their wallet and scans this code.</li>
              <li>
                Their phone then shows a code back to you — tap{' '}
                <span className="font-medium text-ink">Scan their code</span>{' '}
                below and point your camera at it.
              </li>
            </ol>
            {identity ? (
              <div className="mt-3">
                <QrShow text={canonicalEnvelope(identity)} label="Your code" />
                <button
                  type="button"
                  onClick={async () => {
                    if (!identity) return;
                    const code = canonicalEnvelope(identity);
                    try {
                      await navigator.clipboard.writeText(code);
                      setIdentityCopied(true);
                      setTimeout(() => setIdentityCopied(false), 1500);
                    } catch {
                      window.prompt('Copy your code:', code);
                    }
                  }}
                  className="mt-2 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
                >
                  {identityCopied
                    ? '✓ Copied — paste it to them'
                    : '📋 Copy my code (if their camera won’t scan)'}
                </button>
              </div>
            ) : (
              <p className="mt-2 text-sm text-red-600">
                Your identity isn't ready yet.
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                setScanInitialMode('camera');
                setScanning(true);
              }}
              className={`mt-3 ${primaryBtn}`}
            >
              Scan their code →
            </button>
            <button
              type="button"
              onClick={() => {
                setScanInitialMode('paste');
                setScanning(true);
              }}
              className="mt-2 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
            >
              📋 Paste their code instead
            </button>
            <button
              type="button"
              onClick={() => setOpenPanel('not-here')}
              className="mt-3 w-full text-center text-xs text-muted underline"
            >
              They're not with me right now
            </button>
          </div>
        )}

        {step === 'start' && openPanel === 'not-here' && (
          <div className="mt-3">
            <div className={`${eyebrow}`}>Far away</div>
            <h3 className="mt-1 text-lg font-semibold">
              Send {remoteName.trim() || 'them'} a connection
            </h3>
            <p className="mt-1 text-sm text-muted">
              Paste or pick their public key. It lands in their wallet and
              they can say yes whenever — you don't both need to be online at
              the same time.
              {!prefs.nostrTransportEnabled &&
                ' Turn on staying reachable in Settings first so it can send.'}
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
                placeholder="What should the record call them?"
                className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
              />
            </label>
            <RelationshipChips value={relationship} onChange={setRelationship} />
            <button
              type="button"
              onClick={startRemoteHandshake}
              disabled={busy || remotePubkey.trim().length === 0}
              className={`mt-3 ${primaryBtn}`}
            >
              {busy ? 'Sending…' : 'Send connection'}
            </button>
            <button
              type="button"
              onClick={() => setOpenPanel('with-you')}
              className="mt-3 w-full text-center text-xs text-muted underline"
            >
              They're with me right now
            </button>
          </div>
        )}

        {step === 'remote-sent' && (
          <div className="mt-3 text-center">
            <div className={eyebrow}>Sent · Online connection</div>
            <h3 className="mt-1 text-lg font-semibold">
              Connection sent to {peerName || 'them'}
            </h3>
            <p className="mt-1 text-sm text-muted">
              Your copy is saved. Once they say yes, your wallet picks up
              their yes from your inbox on its own — nothing else to do.
            </p>
            {handshake && readHandshake(handshake).metInPerson && (
              <p className="mt-2 text-xs text-muted">
                Saved with your note that you met in person.
              </p>
            )}
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

        {step === 'i-preview' && (
          <>
            <div className={`mt-2 ${eyebrow}`}>In person · Step 2 of 3</div>
            <h3 className="mt-1 text-lg font-semibold">
              Connect with {peerName || 'this person'}?
            </h3>
            <p className="mt-1 text-sm text-muted">
              You scanned their code. Confirm here, then your phone shows one
              last code for them to scan. You'll both keep a copy, locked to
              Bitcoin's clock.
            </p>
            {handshake && readHandshake(handshake).relationship && (
              <div className="mt-3 rounded-md border border-ink/15 bg-ink/[0.02] px-3 py-2 text-sm">
                <span className="text-muted">They labelled this connection</span>{' '}
                <span className="font-medium">
                  {relationshipLabel(readHandshake(handshake).relationship)}
                </span>
                <span className="text-muted">. Confirming means you agree.</span>
              </div>
            )}
            <button
              type="button"
              onClick={coSign}
              disabled={busy}
              className={`mt-4 ${primaryBtn}`}
            >
              {busy ? 'Confirming…' : 'Confirm this connection'}
            </button>
          </>
        )}

        {step === 'i-show-cosigned' && (
          <>
            <div className={`mt-2 ${eyebrow}`}>In person · Step 3 of 3</div>
            <h3 className="mt-1 text-lg font-semibold">
              Last step — show this code
            </h3>
            <p className="mt-1 text-sm text-muted">
              Hold your phone up so {peerName || 'they'} can scan this. Once
              they do, their wallet has the confirmed copy and you're both
              done. You can close this now.
            </p>
            {handshake && (
              <QrShow
                text={canonicalEnvelope(handshake)}
                label="Confirmed connection — let them scan it"
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
            <div className={`mt-2 ${eyebrow}`}>Connect</div>
            <h3 className="mt-1 text-lg font-semibold">Scan their code</h3>
            <p className="mt-1 text-sm text-muted">
              Point your camera at the code on the other person's wallet. You'll
              confirm the connection on the next screen.
            </p>
            <button
              type="button"
              onClick={() => {
                setScanInitialMode('camera');
                setScanning(true);
              }}
              className={`mt-4 ${primaryBtn}`}
            >
              Scan their code
            </button>
            <button
              type="button"
              onClick={() => {
                setScanInitialMode('paste');
                setScanning(true);
              }}
              className="mt-2 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
            >
              📋 Paste their code instead
            </button>
          </>
        )}

        {step === 'r-preview' && (
          <>
            <div className={`mt-2 ${eyebrow}`}>
              {canFinishOverNostr ? 'Connect' : 'In person · Step 2 of 3'}
            </div>
            <h3 className="mt-1 text-lg font-semibold">
              Connect with {peerName || 'this person'}?
            </h3>
            <RelationshipChips
              value={relationship}
              onChange={setRelationship}
            />

            {canFinishOverNostr ? (
              <>
                <p className="mt-3 text-sm text-muted">
                  You scanned their code. Send the connection and you're done —
                  it reaches their wallet and they approve it on their phone.
                  Nothing else to scan.
                </p>
                <label className="mt-3 flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={metInPerson}
                    onChange={(e) => setMetInPerson(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    We met in person
                    <span className="block text-xs text-muted">
                      Your word, saved on the record — not the same as the
                      stronger face-to-face proof below.
                    </span>
                  </span>
                </label>
                <button
                  type="button"
                  onClick={sendScannedOverNostr}
                  disabled={busy}
                  className={`mt-4 ${primaryBtn}`}
                >
                  {busy ? 'Sending…' : 'Send connection'}
                </button>
                <button
                  type="button"
                  onClick={buildAndSign}
                  disabled={busy}
                  className="mt-2 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
                >
                  Prove it in person instead (scan back & forth)
                </button>
              </>
            ) : (
              <>
                <p className="mt-3 text-sm text-muted">
                  You scanned their code. Say yes here and your phone will show
                  a code back for them to scan — then you're both done.
                </p>
                <button
                  type="button"
                  onClick={buildAndSign}
                  disabled={busy}
                  className={`mt-4 ${primaryBtn}`}
                >
                  {busy ? 'Saving…' : 'Yes — show my code back'}
                </button>
              </>
            )}
          </>
        )}

        {step === 'r-show-handshake' && (
          <>
            <div className={`mt-2 ${eyebrow}`}>In person · Step 3 of 3</div>
            <h3 className="mt-1 text-lg font-semibold">
              Show this back to {peerName || 'them'}
            </h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
              <li>They scan this code and confirm on their phone.</li>
              <li>
                Their phone shows one last code — tap{' '}
                <span className="font-medium text-ink">Scan their code</span>{' '}
                and scan it to finish.
              </li>
            </ol>
            {handshake && (
              <QrShow
                text={canonicalEnvelope(handshake)}
                label="Your code — let them scan it"
              />
            )}
            <button
              type="button"
              onClick={() => {
                setScanInitialMode('camera');
                setScanning(true);
              }}
              disabled={busy}
              className={`mt-4 ${primaryBtn}`}
            >
              {busy ? 'Saving…' : 'Scan their code →'}
            </button>
          </>
        )}

        {step === 'done' && (
          <div className="mt-3 text-center animate-fresh-stamp motion-reduce:animate-none">
            <div className={eyebrow}>Connected</div>
            <h3 className="mt-1 text-lg font-semibold">
              You're connected with {peerName || 'them'}
            </h3>
            <p className="mt-1 text-sm text-muted">
              You both said yes, in person, and it's locked to Bitcoin's
              clock. You'll find it under People.
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
        <QrScanModal
          onScanned={handleScan}
          onClose={() => setScanning(false)}
          initialMode={scanInitialMode}
        />
      )}
    </div>
  );
}


