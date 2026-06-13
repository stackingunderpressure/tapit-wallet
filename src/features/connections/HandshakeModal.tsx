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
  'w-full rounded-md bg-ink py-3 text-paper text-sm font-medium disabled:opacity-40';

// Relationship-leaf options the chip picker offers. Wire values are
// lowercase so they stay stable across builds; display labels are
// capitalised for the operator's eyes. Empty string means the
// operator chose not to label the bond — the leaf is omitted from
// the attestation, which round-trips as relationship: '' on read.
// Immediate-family options surface first so the attested
// relationship can be specific where it matters most (spouse +
// child were operator-named must-haves; parent + sibling round
// out the immediate set). 'family' stays as the catch-all for
// extended relatives. Order matters — the chip picker renders in
// declaration order, and family-shaped bonds clustering at the
// top is the right discoverability default for the families-first
// pilot the wallet is targeting.
const RELATIONSHIPS: { value: string; label: string }[] = [
  { value: 'spouse', label: 'Spouse' },
  { value: 'child', label: 'Child' },
  { value: 'parent', label: 'Parent' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'family', label: 'Family' },
  { value: 'friend', label: 'Friend' },
  { value: 'coworker', label: 'Coworker' },
  { value: 'acquaintance', label: 'Acquaintance' },
  { value: 'other', label: 'Other' },
];

/** Capitalised display form of a relationship wire value. */
function relationshipLabel(value: string): string {
  return RELATIONSHIPS.find((r) => r.value === value)?.label ?? value;
}

export function HandshakeModal({ onClose }: Props) {
  const { wallet, ownerId, holdings, identity, anchorWorker, prefs, sendEnvelope, save } = useWallet();
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
              Connecting links you and another person. Start one if you're
              the one inviting them — works whether they're with you in
              person or across the world. Join one if they've already
              started by showing you their code.
            </p>
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => setStep('start')}
                className={primaryBtn}
              >
                Start a handshake
              </button>
              <button
                type="button"
                onClick={() => setStep('r-ready')}
                className="w-full rounded-md border border-ink/15 py-3 text-sm font-medium"
              >
                Join one in person
              </button>
            </div>
          </>
        )}

        {step === 'start' && (
          <div className="mt-3 space-y-2">
            <AccordionPanel
              label="If they're with you"
              hint="Show your code · scan theirs"
              open={openPanel === 'with-you'}
              onToggle={() =>
                setOpenPanel(openPanel === 'with-you' ? 'not-here' : 'with-you')
              }
            >
              {identity ? (
                <QrShow
                  text={canonicalEnvelope(identity)}
                  label="Show them this code"
                />
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
            </AccordionPanel>

            <AccordionPanel
              label="If they're not here"
              hint={
                prefs.nostrTransportEnabled
                  ? 'Pick or paste their public key'
                  : 'Needs you online'
              }
              open={openPanel === 'not-here'}
              onToggle={() =>
                setOpenPanel(openPanel === 'not-here' ? 'with-you' : 'not-here')
              }
            >
              <PeerPicker
                holdings={holdings}
                myIdentity={identity?.subject ?? ''}
                value={remotePubkey}
                onChange={setRemotePubkey}
              />
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
              <RelationshipChips
                value={relationship}
                onChange={setRelationship}
              />
              <button
                type="button"
                onClick={startRemoteHandshake}
                disabled={busy || remotePubkey.trim().length === 0}
                className={`mt-3 ${primaryBtn}`}
              >
                {busy ? 'Sending…' : 'Send connection'}
              </button>
            </AccordionPanel>
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
            <div className={`mt-2 ${eyebrow}`}>Step 2 of 3</div>
            <h3 className="mt-1 text-lg font-semibold">
              Connect with {peerName || 'this person'}?
            </h3>
            <p className="mt-1 text-sm text-muted">
              This records that you two connected in person, and you both
              keep a copy. It's locked to Bitcoin's clock like everything else.
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
            <div className={`mt-2 ${eyebrow}`}>Step 3 of 3</div>
            <p className="mt-1 text-sm text-muted">
              Show this back to {peerName || 'them'} so their wallet
              gets the final, confirmed copy. Then you're done.
            </p>
            {handshake && (
              <QrShow
                text={canonicalEnvelope(handshake)}
                label="Confirmed connection"
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
              Scan the code the other person is showing you on their wallet.
            </p>
            <button
              type="button"
              onClick={() => setScanning(true)}
              className={`mt-4 ${primaryBtn}`}
            >
              Scan their code
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
              This makes one in-person connection. You say yes now, they
              say yes next, and you both keep a copy.
            </p>
            <RelationshipChips
              value={relationship}
              onChange={setRelationship}
            />
            <button
              type="button"
              onClick={buildAndSign}
              disabled={busy}
              className={`mt-4 ${primaryBtn}`}
            >
              {busy ? 'Saving…' : 'Connect'}
            </button>
          </>
        )}

        {step === 'r-show-handshake' && (
          <>
            <div className={`mt-2 ${eyebrow}`}>Step 3 of 3</div>
            <p className="mt-1 text-sm text-muted">
              Show this to {peerName || 'them'}. They scan it and say yes,
              then show you their final code.
            </p>
            {handshake && (
              <QrShow
                text={canonicalEnvelope(handshake)}
                label="Your connection"
              />
            )}
            <button
              type="button"
              onClick={() => setScanning(true)}
              disabled={busy}
              className={`mt-4 ${primaryBtn}`}
            >
              {busy ? 'Saving…' : 'Next: scan their confirmed code'}
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

// Chip picker for the optional relationship leaf. Tapping a chip
// toggles its selection — picking the same chip again clears the
// label entirely so the leaf is omitted from the envelope. Both
// the in-person builder (r-preview) and the remote initiator
// (not-here panel) render this; the picker writes to the parent's
// `relationship` state which the build* functions read at signing.
function RelationshipChips({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="mt-3">
      <div className="text-xs text-muted">How do you know them? (optional)</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {RELATIONSHIPS.map((r) => {
          const selected = value === r.value;
          return (
            <button
              key={r.value}
              type="button"
              onClick={() => onChange(selected ? '' : r.value)}
              aria-pressed={selected}
              className={
                'rounded-full border px-3 py-1 text-xs font-medium transition ' +
                (selected
                  ? 'border-ink bg-ink text-paper'
                  : 'border-ink/15 bg-white text-ink hover:bg-ink/[0.04]')
              }
            >
              {r.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Lightweight controlled accordion panel. Header line carries the
// section label + a one-line hint and a rotating chevron; body
// only renders when open so closed panels are tap-targets that
// take no vertical room beyond the header. Used by the unified
// Start step to fit two handshake paths (in-person + remote) on
// one screen without forcing the operator to scroll past one to
// reach the other.
function AccordionPanel({
  label,
  hint,
  open,
  onToggle,
  children,
}: {
  label: string;
  hint: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-ink/10 bg-white overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-ink/[0.02]"
      >
        <div className="min-w-0">
          <div className={eyebrow}>{label}</div>
          <div className="mt-0.5 text-xs text-muted truncate">{hint}</div>
        </div>
        <span
          aria-hidden
          className={`shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
        >
          ▾
        </span>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </section>
  );
}
