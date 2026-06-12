import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  disclosedLeavesOf,
  verifyDisclosureProof,
  verifyMultiDisclosureProof,
  type DisclosureMeta,
  type FieldValue,
  type Signature,
} from 'tapit-attest';
import { parseDisclosureProof } from './parseDisclosureProof.ts';
import { QrScanModal } from '../qr/QrScanModal.tsx';
import { HowVerificationWorks } from './HowVerificationWorks.tsx';
import {
  verifyGatedReleaseBundle,
  type GatedReleaseBundle,
} from '../identity-gate/gatedReleaseBundle.ts';
import {
  readBundleAnchor,
  verifyProofAnchor,
  type AnchorCheck,
  type ProofAnchor,
} from './verifyProofAnchor.ts';
import { otsBytesFromHex, OTS_DOWNLOAD_NAME } from './exportProof.ts';

interface VerifiedField {
  path: string;
  name: string;
  value: FieldValue;
}

type Outcome =
  | { kind: 'idle' }
  | { kind: 'error'; detail: string }
  | {
      kind: 'result';
      meta: DisclosureMeta;
      signatures: Signature[];
      fields: VerifiedField[];
      valid: boolean;
      digest: string;
      signers: { signer: string; valid: boolean }[];
      errors: string[];
      anchor: ProofAnchor | null;
    }
  | {
      kind: 'gate';
      released: boolean;
      forLeaf: string;
      identityPubkey: string;
      validCount: number;
      threshold: number;
      detail: string;
    };

// Detect + verify a gated-release bundle (item 11 D4). Returns a 'gate'
// outcome when the text is a gated_release bundle, or null when it isn't
// one (so the caller falls through to the disclosure-proof path).
function tryVerifyGateBundle(text: string): Outcome | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.trim());
  } catch {
    return null;
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    (parsed as Record<string, unknown>).bundle_type !== 'gated_release'
  ) {
    return null;
  }
  const bundle = parsed as unknown as GatedReleaseBundle;
  const verdict = verifyGatedReleaseBundle(bundle);
  if (verdict.kind === 'released') {
    return {
      kind: 'gate',
      released: true,
      forLeaf: bundle.forLeaf,
      identityPubkey: bundle.identityPubkey,
      validCount: verdict.validCount,
      threshold: verdict.threshold,
      detail: `${verdict.validCount} of the people this identity designated have vouched.`,
    };
  }
  return {
    kind: 'gate',
    released: false,
    forLeaf: bundle.forLeaf ?? '(unknown)',
    identityPubkey: bundle.identityPubkey ?? '',
    validCount: verdict.bundleResult?.validCount ?? 0,
    threshold: 0,
    detail: verdict.detail,
  };
}

function shortKey(s: string): string {
  if (s.length <= 16) return s;
  return `${s.slice(0, 8)}…${s.slice(-4)}`;
}

function asString(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return '';
}

// Public verifier route. Lives outside AuthGate — the verifier may not
// have a wallet of their own; they just need a copy of the wallet PWA
// to run the verifier against the math. Handles both bundle kinds:
// legacy single-leaf bundles still in the wild, and the multi-leaf
// bundles new wallets produce. The disclosed-fields list is rendered
// uniformly regardless of which kind arrived.
function decodeInlineProof(encoded: string): string {
  // Decode the base64url-encoded proof bundle from the ?p= query
  // parameter the Fresh share card mints. Mirrors the encoder in
  // QuickShareModal — replace url-safe chars, restore padding,
  // atob, then UTF-8 round-trip.
  const padded = encoded
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(encoded.length + ((4 - (encoded.length % 4)) % 4), '=');
  const latin1 = atob(padded);
  return decodeURIComponent(escape(latin1));
}

export function VerifyProofScreen() {
  const [searchParams] = useSearchParams();
  const [raw, setRaw] = useState('');
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' });
  const [scanning, setScanning] = useState(false);
  const [anchorCheck, setAnchorCheck] = useState<AnchorCheck>({ state: 'none' });
  const [copied, setCopied] = useState(false);

  // Portable verify: copy the self-contained proof JSON so it can be re-checked
  // in any compatible verifier off this page.
  async function copyProof() {
    try {
      await navigator.clipboard.writeText(raw);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('Copy the proof:', raw);
    }
  }

  // Portable verify: hand out the Bitcoin timestamp as a STANDARD .ots file so
  // a verifier can check it with the canonical `ots` client / opentimestamps.org
  // against the digest — no app, no server, no trusting this page. Only wired
  // up once the anchor has already parsed + verified here, so the bytes are a
  // known-good standard proof.
  function downloadOts(proofHex: string) {
    try {
      const bytes = otsBytesFromHex(proofHex);
      // Copy into a plain ArrayBuffer — a Uint8Array<ArrayBufferLike> is not a
      // BlobPart under the strict typed-array lib, an ArrayBuffer always is.
      const buf = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(buf).set(bytes);
      const blob = new Blob([buf], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = OTS_DOWNLOAD_NAME;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      /* button only renders for already-parsed proofs; nothing to do */
    }
  }

  // When a VALID disclosure result carries a Bitcoin anchor, re-verify the
  // anchor against the proven digest (async, network-free) and show the
  // block. Only runs for valid proofs — a Bitcoin timestamp on a proof
  // whose signature didn't check out is meaningless.
  useEffect(() => {
    if (outcome.kind !== 'result' || !outcome.valid || !outcome.anchor) {
      setAnchorCheck({ state: 'none' });
      return;
    }
    let cancelled = false;
    setAnchorCheck({ state: 'checking' });
    void verifyProofAnchor(outcome.digest, outcome.anchor).then((c) => {
      if (!cancelled) setAnchorCheck(c);
    });
    return () => {
      cancelled = true;
    };
  }, [outcome]);

  function verifyText(text: string) {
    try {
      // A gated-release bundle (item 11 D4) is a different shape than a
      // disclosure proof — detect it first and run its own verifier.
      const gate = tryVerifyGateBundle(text);
      if (gate) {
        setOutcome(gate);
        return;
      }
      const parsed = parseDisclosureProof(text);
      const anchor = readBundleAnchor(
        (parsed.bundle as { anchor?: unknown }).anchor,
      );
      if (parsed.kind === 'multi') {
        const result = verifyMultiDisclosureProof(parsed.bundle);
        const fields = disclosedLeavesOf(parsed.bundle).map((d) => ({
          path: d.path,
          name: d.name,
          value: d.value,
        }));
        setOutcome({
          kind: 'result',
          meta: parsed.bundle.meta,
          signatures: parsed.bundle.signatures,
          fields,
          valid: result.valid,
          digest: result.digest,
          signers: result.signers,
          errors: result.errors,
          anchor,
        });
      } else {
        const result = verifyDisclosureProof(parsed.bundle);
        setOutcome({
          kind: 'result',
          meta: parsed.bundle.meta,
          signatures: parsed.bundle.signatures,
          fields: [
            {
              path: parsed.bundle.leaf.name,
              name: parsed.bundle.leaf.name,
              value: parsed.bundle.leaf.value,
            },
          ],
          valid: result.valid,
          digest: result.digest,
          signers: result.signers,
          errors: result.errors,
          anchor,
        });
      }
    } catch (err) {
      setOutcome({
        kind: 'error',
        detail: err instanceof Error ? err.message : 'could not verify',
      });
    }
  }

  function verify() {
    verifyText(raw);
  }

  // One-tap verify path: the Fresh share card mints links like
  // /verify?p=<base64url-encoded-bundle>. Decode, paste into the
  // textarea so the operator can see exactly what was verified,
  // and run the verifier. Falls back gracefully when decode fails
  // (badly-truncated link, manual paste of a typo) by surfacing
  // the error in the same Outcome surface a paste would.
  useEffect(() => {
    const encoded = searchParams.get('p');
    if (!encoded) return;
    let decoded: string;
    try {
      decoded = decodeInlineProof(encoded);
    } catch {
      setOutcome({
        kind: 'error',
        detail: 'The verify link is malformed — paste the proof manually.',
      });
      return;
    }
    setRaw(decoded);
    verifyText(decoded);
  }, [searchParams]);

  return (
    <div className="min-h-screen p-5 max-w-md mx-auto">
      <header className="flex items-center justify-between py-2">
        <Link to="/" className="text-sm text-muted hover:text-ink">
          ← Home
        </Link>
        <h1 className="text-lg font-semibold">Verify a proof</h1>
        <span className="w-12" aria-hidden />
      </header>

      <section className="mt-4 rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
        <p className="text-sm text-muted">
          Paste a proof someone shared with you. The math will check whether
          the fields they revealed really are part of a signed entry by the
          key you would expect — without you having to trust this page.
        </p>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={8}
          autoFocus
          placeholder="Paste the proof here…"
          className="mt-3 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-xs font-mono"
        />
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={verify}
            disabled={raw.trim().length === 0}
            className="flex-1 rounded-md bg-ink py-2 text-paper text-sm font-medium disabled:opacity-40"
          >
            Verify
          </button>
          <button
            type="button"
            onClick={() => setScanning(true)}
            className="rounded-md border border-ink/15 px-4 py-2 text-sm"
          >
            Scan QR
          </button>
        </div>
      </section>

      {scanning && (
        <QrScanModal
          onScanned={(text) => {
            setRaw(text);
            setScanning(false);
          }}
          onClose={() => setScanning(false)}
        />
      )}

      {outcome.kind === 'error' && (
        <section className="mt-4 rounded-2xl bg-white border border-amber-200 p-5 shadow-sm">
          <p className="text-sm font-medium">This is not a valid proof.</p>
          <p className="mt-2 text-xs text-muted">{outcome.detail}</p>
        </section>
      )}

      {outcome.kind === 'gate' && (
        <section
          className={`mt-4 rounded-2xl border p-5 shadow-sm ${
            outcome.released
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          <p className="text-sm font-medium">
            {outcome.released
              ? 'Peer-vouched gate: released.'
              : 'Peer-vouched gate: NOT released.'}
          </p>
          <p
            className={`mt-1 text-xs ${
              outcome.released ? 'text-emerald-800' : 'text-red-800'
            }`}
          >
            {outcome.released
              ? `The math checks out: ${outcome.validCount} of ${outcome.threshold} required people — each one in this identity's own designated circle, each signing a fresh, unexpired vouch — attested that this identity controls "${outcome.forLeaf}." The policy and the circle are both signed by the identity itself, so a forged policy can't widen who counts.`
              : outcome.detail}
          </p>
          <div className="mt-3 text-xs uppercase tracking-wide text-muted">
            Identity
          </div>
          <div className="mt-1 font-mono text-sm break-all">
            {outcome.identityPubkey}
          </div>
          <p className="mt-3 rounded-md border border-ink/10 bg-ink/[0.02] px-3 py-2 text-xs text-muted">
            What this proves and does NOT: it proves people this person
            designated vouched they control this — not that the underlying
            claim is true, and not that you must act on it. It is one extra
            thing you can check, alongside however you already decide to
            trust someone.
          </p>
        </section>
      )}

      {outcome.kind === 'result' && (
        <section
          className={`mt-4 rounded-2xl border p-5 shadow-sm ${
            outcome.valid
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          <p className="text-sm font-medium">
            {outcome.valid ? 'Proof is valid.' : 'Proof did NOT verify.'}
          </p>
          <p
            className={`mt-1 text-xs ${
              outcome.valid ? 'text-emerald-800' : 'text-red-800'
            }`}
          >
            {outcome.valid
              ? "The math lines up — the fields below were committed to a signed root the signer's key actually signed. Nothing has been changed since signing."
              : "The math does not line up. The signer's key did NOT sign this exact version of the fields below. Something has been changed somewhere — or this is not a real proof."}
          </p>
          <div className="mt-3 text-xs uppercase tracking-wide text-muted">
            {outcome.fields.length === 1 ? 'Disclosed field' : 'Disclosed fields'}
          </div>
          <ul className="mt-1 space-y-1">
            {outcome.fields.map((f) => (
              <li key={f.path} className="text-sm">
                <span className="text-muted">{f.name}: </span>
                <span className="font-medium break-words">
                  {asString(f.value)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 text-xs uppercase tracking-wide text-muted">
            Signed envelope
          </div>
          <div className="mt-1 text-sm">
            <div>
              <span className="text-muted">Kind: </span>
              {outcome.meta.kind}
            </div>
            <div>
              <span className="text-muted">Tier: </span>
              {outcome.meta.tier}
            </div>
            <div>
              <span className="text-muted">Subject: </span>
              <span className="font-mono break-words">{outcome.meta.subject}</span>
            </div>
            <div>
              <span className="text-muted">Issued at: </span>
              {new Date(outcome.meta.issuedAt).toLocaleString()}
            </div>
          </div>
          <div className="mt-3 text-xs uppercase tracking-wide text-muted">
            Signers
          </div>
          <ul className="mt-1 space-y-0.5">
            {outcome.signers.map((s, i) => (
              <li key={i} className="text-sm font-mono">
                {s.valid ? '✓' : '✗'} {shortKey(s.signer)}
              </li>
            ))}
          </ul>
          {outcome.errors.length > 0 && (
            <>
              <div className="mt-3 text-xs uppercase tracking-wide text-muted">
                Notes
              </div>
              <ul className="mt-1 space-y-0.5">
                {outcome.errors.map((e, i) => (
                  <li key={i} className="text-xs text-muted">
                    {e}
                  </li>
                ))}
              </ul>
            </>
          )}

          {outcome.valid && outcome.anchor && (
            <>
              <div className="mt-3 text-xs uppercase tracking-wide text-muted">
                Bitcoin timestamp
              </div>
              {anchorCheck.state === 'checking' && (
                <p className="mt-1 text-sm text-muted">Checking the timestamp…</p>
              )}
              {anchorCheck.state === 'confirmed' && (
                <div className="mt-1 text-sm">
                  <p>
                    Timestamped to{' '}
                    <a
                      href={`https://mempool.space/block/${anchorCheck.btcHeight}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-accent underline"
                    >
                      Bitcoin block {anchorCheck.btcHeight}
                    </a>
                    .
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    The timestamp proof included here genuinely commits this
                    exact entry to that block — so this existed, unchanged, by
                    the time that block was mined. Tap the block to look it up
                    on a public Bitcoin explorer and confirm it for yourself.
                  </p>
                </div>
              )}
              {anchorCheck.state === 'pending' && (
                <p className="mt-1 text-xs text-muted">
                  The timestamp proof is valid for this entry but has not been
                  confirmed in a Bitcoin block yet — it was submitted to a
                  timestamp calendar and is waiting for the next anchoring.
                </p>
              )}
              {anchorCheck.state === 'mismatch' && (
                <p className="mt-1 text-xs text-amber-700">
                  A timestamp was attached, but it does not check out for this
                  entry ({anchorCheck.reason}) — ignore the timestamp; the
                  signature proof above still stands on its own.
                </p>
              )}
            </>
          )}

          <div className="mt-4 border-t border-ink/10 pt-3">
            <div className="text-xs uppercase tracking-wide text-muted">
              Verify this without this page
            </div>
            <p className="mt-1 text-xs text-muted">
              Don't take our word for it — these checks run anywhere, with no app,
              server, or trust in this page. Copy the proof to re-check the
              signature math in any compatible verifier.
              {outcome.anchor
                ? ' Download the Bitcoin timestamp as a standard OpenTimestamps (.ots) file and verify it against the chain with the ots client or opentimestamps.org, using the digest below.'
                : ''}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copyProof()}
                className="rounded-md border border-ink/15 px-3 py-1.5 text-xs font-medium hover:bg-ink/5"
              >
                {copied ? 'Copied' : 'Copy proof'}
              </button>
              {outcome.anchor &&
                (anchorCheck.state === 'confirmed' ||
                  anchorCheck.state === 'pending') && (
                  <button
                    type="button"
                    onClick={() =>
                      outcome.anchor && downloadOts(outcome.anchor.proof)
                    }
                    className="rounded-md border border-ink/15 px-3 py-1.5 text-xs font-medium hover:bg-ink/5"
                  >
                    Download Bitcoin timestamp (.ots)
                  </button>
                )}
            </div>
            <div className="mt-2 text-[10px] uppercase tracking-wide text-muted">
              Digest
            </div>
            <p className="mt-0.5 break-all rounded bg-ink/[0.04] px-2 py-1 font-mono text-[11px]">
              {outcome.digest}
            </p>
          </div>
        </section>
      )}

      {outcome.kind === 'result' && (
        <HowVerificationWorks
          digest={outcome.digest}
          disclosedCount={outcome.fields.length}
          valid={outcome.valid}
          signers={outcome.signers}
        />
      )}
    </div>
  );
}
