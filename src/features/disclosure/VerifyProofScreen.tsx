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
    };

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

  function verifyText(text: string) {
    try {
      const parsed = parseDisclosureProof(text);
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
