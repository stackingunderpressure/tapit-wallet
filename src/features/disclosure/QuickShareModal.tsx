import { useMemo, useState } from 'react';
import type { QuickSharePreset } from './quickSharePresets.ts';
import { ShareCard } from './ShareCard.tsx';
import { buildVerifyUrl } from './buildVerifyUrl.ts';
import { downloadOtsFile } from './exportProof.ts';
import { canShare, shareText } from '../../shared/lib/share.ts';

// Tapping a preset in the Quick-share section opens this modal.
// It mints the multi-disclosure proof bundle for the preset's
// disclosed paths, computes a verifier URL (with the proof inline
// when the encoded bundle fits under a reasonable URL length cap,
// or just /verify when it does not), and renders the Fresh share
// card with copy + share + view-raw-JSON actions.
//
// The proof-mint + verify-URL logic lives in buildVerifyUrl.ts so
// this modal and the stamped-photo corner QR build the same link.
//
// Cut 7 of the 2026-05-24 Fresh young-adult-friendly theme + IA
// roadmap. Renders only under Fresh (the parent QuickShareSection
// only mounts under Fresh).

interface Props {
  preset: QuickSharePreset;
  onClose: () => void;
}

export function QuickShareModal({ preset, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mint the proof once per preset. The preset reference is stable
  // across the modal lifetime; the underlying attestation does not
  // mutate. buildVerifyUrl is pure, so memoising is safe.
  const minted = useMemo(() => {
    try {
      return buildVerifyUrl(preset.attestation, preset.disclosedPaths);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not mint proof.');
      return null;
    }
    // The disclosedPaths array reference is stable per-preset
    // (built once by enumerateQuickSharePresets) so depending on
    // the preset reference is enough.
  }, [preset]);

  // Anchor + issued_at come from the attestation envelope itself.
  // Anchor is optional — the share card handles the unconfirmed
  // case by showing "Anchoring to Bitcoin…" instead of a block
  // height.
  const anchor = preset.attestation.anchor;
  const btcHeight =
    anchor && anchor.status === 'confirmed' ? anchor.btcHeight : undefined;
  const issuedAt = preset.attestation.issuedAt;

  async function copyProof() {
    if (!minted) return;
    await navigator.clipboard.writeText(minted.json);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  async function copyUrl() {
    if (!minted) return;
    await navigator.clipboard.writeText(minted.verifyUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  async function shareUrl() {
    if (!minted) return;
    const outcome = await shareText({
      title: preset.label,
      text: minted.urlIsInline
        ? minted.verifyUrl
        : `${minted.verifyUrl}\n\nProof:\n${minted.json}`,
    });
    if (outcome === 'copied') {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-md sm:items-center">
      <div className="w-full max-w-md rounded-3xl border border-fresh-surface-edge bg-fresh-surface-raised p-5 shadow-2xl shadow-black/40 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium text-fresh-text-primary">
            Share this proof
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-fresh-text-tertiary hover:text-fresh-text-primary"
          >
            Close
          </button>
        </div>

        {error && (
          <p className="mt-3 text-sm text-fresh-accent-danger" role="alert">
            {error}
          </p>
        )}

        {minted && (
          <>
            <div className="mt-4">
              <ShareCard
                assertion={preset.label}
                evidence={preset.subLabel}
                btcHeight={btcHeight}
                issuedAt={issuedAt}
                verifyUrl={minted.verifyUrl}
              />
            </div>

            <p className="mt-4 text-center text-xs text-fresh-text-secondary">
              {minted.urlIsInline
                ? 'Screenshot this card and send it. Tapping the link in the screenshot opens the verifier with the proof already loaded.'
                : 'Screenshot this card and send it alongside the proof JSON below — the proof is a bit large for an inline URL, so the verifier pastes it into /verify.'}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {canShare() && (
                <button
                  type="button"
                  onClick={() => void shareUrl()}
                  className="flex-1 rounded-2xl bg-fresh-accent-primary py-3 text-sm font-medium text-fresh-text-inverse shadow-[0_8px_30px_-8px_rgba(192,252,77,0.6)] transition active:animate-fresh-press motion-reduce:active:animate-none"
                >
                  Share link
                </button>
              )}
              <button
                type="button"
                onClick={() => void copyUrl()}
                className="flex-1 rounded-2xl border border-fresh-surface-edge bg-fresh-surface-glass py-3 text-sm font-medium text-fresh-text-primary backdrop-blur-xl"
              >
                {copied ? 'Copied' : 'Copy link'}
              </button>
            </div>

            {anchor?.proof && (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => downloadOtsFile(anchor.proof)}
                  className="w-full rounded-2xl border border-fresh-surface-edge bg-fresh-surface-glass py-2.5 text-xs font-medium text-fresh-text-primary backdrop-blur-xl"
                >
                  Download Bitcoin timestamp (.ots)
                </button>
                <p className="mt-1.5 text-center text-[0.7rem] text-fresh-text-secondary">
                  Lets whoever you send it to confirm the Bitcoin timestamp
                  themselves with the standard OpenTimestamps tools — no app, and
                  no taking our word for it.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowJson((v) => !v)}
              className="mt-4 w-full text-xs text-fresh-accent-secondary hover:underline"
            >
              {showJson ? 'Hide proof JSON' : 'Show proof JSON'}
            </button>
            {showJson && (
              <div className="mt-2">
                <textarea
                  readOnly
                  value={minted.json}
                  rows={6}
                  className="w-full rounded-2xl border border-fresh-surface-edge bg-fresh-surface-glass px-3 py-2 font-fresh-mono text-[0.7rem] text-fresh-text-primary backdrop-blur-xl"
                />
                <button
                  type="button"
                  onClick={() => void copyProof()}
                  className="mt-2 w-full rounded-2xl border border-fresh-surface-edge bg-fresh-surface-glass py-2 text-xs font-medium text-fresh-text-primary backdrop-blur-xl"
                >
                  {copied ? 'Copied' : 'Copy proof JSON'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
