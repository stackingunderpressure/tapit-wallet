import { lazy, Suspense, useMemo, useState } from 'react';
import type { Attestation } from 'tapit-attest';
import { multiDisclosureProof, envelopeId } from 'tapit-attest';
import { leafIndex } from './leafIndex.ts';
import { canShare, shareText } from '../../shared/lib/share.ts';
import { downloadOtsFile } from './exportProof.ts';
import { QrShow } from '../qr/QrShow.tsx';
import { useWallet } from '../wallet-core/useWallet.ts';
import { anchorQueue } from '../anchoring/anchorQueue.ts';
import { deriveVerificationStatus } from '../anchoring/verificationStatus.ts';

// Cut 7 of the Fresh roadmap — when the operator is under Fresh,
// the "View as share card" button in the generated state opens
// the same QuickShareModal that the Settings Quick-share presets
// open, pre-filled with the leaves the operator just selected.
// Lazy-loaded so Classic operators never pay for the share-card
// bytes — they only render the existing JSON+QR+Copy flow.
const QuickShareModal = lazy(() =>
  import('./QuickShareModal.tsx').then((m) => ({
    default: m.QuickShareModal,
  })),
);

interface Props {
  attestation: Attestation;
  onClose: () => void;
  /**
   * Sub-cut 2c disclose-proof promote target — when present,
   * the modal title surfaces "Send a proof to <peerLabel>"
   * framing so the operator sees who the proof is intended for.
   * The proof itself still travels through the existing Share /
   * Copy / QR channels (the operator manually delivers it via
   * whatever channel they pick); a future cut may add direct
   * Mycelium delivery of the proof bundle.
   */
  peerLabel?: string;
}

type Step =
  | { kind: 'pick' }
  | { kind: 'generated'; paths: string[]; json: string; otsProofHex?: string };

// "Share a proof" flow. The operator picks one or more leaves out of
// the attestation's claim tree and the wallet calls
// multiDisclosureProof to produce a bundle they can hand to any
// verifier — text, AirDrop, posted on a website, scanned via QR. The
// bundle is plain JSON; the verifier pastes it into /verify on their
// copy of the wallet PWA and the math checks itself.
//
// One leaf and many leaves go through the same multi-proof primitive —
// the bundle shape is one tree with disclosed-or-hashed children, so
// adding a second field to the selection just keeps an extra branch
// inline instead of replacing it with a sibling hash.

function asString(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return '';
}

export function ShareProofModal({ attestation, onClose, peerLabel }: Props) {
  const { resolvedTheme, ownerId } = useWallet();
  const leaves = useMemo(() => leafIndex(attestation.claim), [attestation]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [step, setStep] = useState<Step>({ kind: 'pick' });
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [shareCardOpen, setShareCardOpen] = useState(false);

  function toggle(path: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  async function generate() {
    if (selected.size === 0) {
      setError('pick at least one field to disclose');
      return;
    }
    setError(null);
    try {
      const paths = [...selected];
      const bundle = multiDisclosureProof(attestation, paths);
      // Carry the Bitcoin anchor alongside the proof so /verify can show
      // "anchored in block N" (verifyProofAnchor re-verifies it against the
      // proven digest — it's not trusted blindly). App-layer field; the
      // chassis verifier ignores it. Source the confirmed anchor via
      // deriveVerificationStatus, which checks the attestation AND the live
      // anchor row — the row is where a freshly-confirmed anchor lives
      // before the write-back copies it onto the held attestation, so this
      // attaches the block even when attestation.anchor isn't populated yet.
      const row = ownerId
        ? await anchorQueue.get(ownerId, envelopeId(attestation))
        : undefined;
      const anchor = deriveVerificationStatus(attestation, row).anchor;
      const shared = anchor ? { ...bundle, anchor } : bundle;
      const json = JSON.stringify(shared, null, 2);
      setStep({ kind: 'generated', paths, json, otsProofHex: anchor?.proof });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'could not generate proof');
    }
  }

  async function copy() {
    if (step.kind !== 'generated') return;
    await navigator.clipboard.writeText(step.json);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function share() {
    if (step.kind !== 'generated') return;
    const outcome = await shareText({
      title: 'Tapit Wallet — disclosure proof',
      text: step.json,
    });
    if (outcome === 'copied') {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/40 flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-paper rounded-2xl p-5 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">
            {peerLabel ? `Send a proof to ${peerLabel}` : 'Share a proof'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted hover:text-ink"
          >
            Close
          </button>
        </div>

        {step.kind === 'pick' && (
          <>
            <p className="mt-2 text-sm text-muted">
              Pick one or more fields to reveal. The verifier gets a proof
              that these fields belong to this signed entry, without seeing
              any other field on the entry.
            </p>
            {leaves.length === 0 ? (
              <p className="mt-3 text-sm">This entry has no disclosable fields.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {leaves.map((l) => (
                  <label
                    key={l.path}
                    className="flex items-start gap-3 rounded-md border border-ink/15 bg-white px-3 py-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(l.path)}
                      onChange={() => toggle(l.path)}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{l.name}</div>
                      <div className="text-xs text-muted break-words">
                        {asString(l.value)}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => void generate()}
              disabled={selected.size === 0}
              className="mt-4 w-full rounded-md bg-ink py-2 text-paper text-sm font-medium disabled:opacity-40"
            >
              {selected.size > 1
                ? `Generate proof for ${selected.size} fields`
                : 'Generate proof'}
            </button>
            {error && (
              <p className="mt-3 text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
          </>
        )}

        {shareCardOpen && step.kind === 'generated' && (
          <Suspense fallback={null}>
            <QuickShareModal
              preset={{
                id: 'adhoc',
                kind: 'verified-profile',
                label: `Proof from this ${attestation.kind}`,
                subLabel: `Reveals ${step.paths.length === 1 ? 'the field' : `${step.paths.length} fields`}: ${step.paths.join(', ')}.`,
                attestation,
                disclosedPaths: step.paths,
              }}
              onClose={() => setShareCardOpen(false)}
            />
          </Suspense>
        )}

        {step.kind === 'generated' && (
          <>
            <p className="mt-2 text-sm text-muted">
              Copy this proof and send it to whoever needs to verify the field
              {step.paths.length === 1 ? ' ' : 's '}
              <span className="font-medium">{step.paths.join(', ')}</span>.
              They paste it into <span className="font-mono">/verify</span> on
              this same wallet site to check it.
            </p>
            <textarea
              readOnly
              value={step.json}
              rows={8}
              className="mt-3 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-xs font-mono"
            />
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setShowQr((v) => !v)}
                className="text-xs text-accent hover:underline"
              >
                {showQr ? 'Hide QR' : 'Show as QR code'}
              </button>
              {resolvedTheme === 'fresh' && (
                <button
                  type="button"
                  onClick={() => setShareCardOpen(true)}
                  className="text-xs text-accent hover:underline"
                >
                  View as share card →
                </button>
              )}
              {step.otsProofHex && (
                <button
                  type="button"
                  onClick={() =>
                    step.otsProofHex && downloadOtsFile(step.otsProofHex)
                  }
                  className="text-xs text-accent hover:underline"
                >
                  Download .ots
                </button>
              )}
            </div>
            {showQr && <QrShow text={step.json} label="Disclosure proof" />}
            <div className="mt-3 flex gap-2 flex-wrap">
              {canShare() && (
                <button
                  type="button"
                  onClick={share}
                  className="flex-1 rounded-md bg-ink py-2 text-paper text-sm font-medium"
                >
                  Share proof
                </button>
              )}
              <button
                type="button"
                onClick={copy}
                className={`${canShare() ? '' : 'flex-1'} rounded-md ${
                  canShare() ? 'border border-ink/15' : 'bg-ink text-paper'
                } px-4 py-2 text-sm font-medium`}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                type="button"
                onClick={() => setStep({ kind: 'pick' })}
                className="rounded-md border border-ink/15 px-4 py-2 text-sm"
              >
                Back
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
