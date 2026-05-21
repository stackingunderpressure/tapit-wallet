import { useState } from 'react';
import { Link } from 'react-router-dom';
import { verifyDisclosureProof, type DisclosureProofBundle } from 'tapit-attest';
import { parseDisclosureProof } from './parseDisclosureProof.ts';

type Outcome =
  | { kind: 'idle' }
  | { kind: 'error'; detail: string }
  | { kind: 'result'; proof: DisclosureProofBundle; valid: boolean; digest: string; signers: { signer: string; valid: boolean }[]; errors: string[] };

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
// to run verifyDisclosureProof against the math. The proof is
// self-contained; the verifier sees the disclosed field, the envelope
// meta the signature was bound to, who signed, and whether the math
// adds up.
export function VerifyProofScreen() {
  const [raw, setRaw] = useState('');
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' });

  function verify() {
    try {
      const proof = parseDisclosureProof(raw);
      const result = verifyDisclosureProof(proof);
      setOutcome({
        kind: 'result',
        proof,
        valid: result.valid,
        digest: result.digest,
        signers: result.signers,
        errors: result.errors,
      });
    } catch (err) {
      setOutcome({
        kind: 'error',
        detail: err instanceof Error ? err.message : 'could not verify',
      });
    }
  }

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
          the field they revealed really is part of a signed entry by the key
          you would expect.
        </p>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={8}
          autoFocus
          placeholder="Paste the proof here…"
          className="mt-3 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-xs font-mono"
        />
        <button
          type="button"
          onClick={verify}
          disabled={raw.trim().length === 0}
          className="mt-3 w-full rounded-md bg-ink py-2 text-paper text-sm font-medium disabled:opacity-40"
        >
          Verify
        </button>
      </section>

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
              : 'bg-amber-50 border-amber-200'
          }`}
        >
          <p className="text-sm font-medium">
            {outcome.valid ? 'Proof is valid.' : 'Proof did NOT verify.'}
          </p>
          <div className="mt-3 text-xs uppercase tracking-wide text-muted">
            Disclosed field
          </div>
          <div className="mt-1 text-sm">
            <span className="text-muted">{outcome.proof.leaf.name}: </span>
            <span className="font-medium break-words">
              {asString(outcome.proof.leaf.value)}
            </span>
          </div>
          <div className="mt-3 text-xs uppercase tracking-wide text-muted">
            Signed envelope
          </div>
          <div className="mt-1 text-sm">
            <div>
              <span className="text-muted">Kind: </span>
              {outcome.proof.meta.kind}
            </div>
            <div>
              <span className="text-muted">Tier: </span>
              {outcome.proof.meta.tier}
            </div>
            <div>
              <span className="text-muted">Subject: </span>
              <span className="font-mono break-words">{outcome.proof.meta.subject}</span>
            </div>
            <div>
              <span className="text-muted">Issued at: </span>
              {new Date(outcome.proof.meta.issuedAt).toLocaleString()}
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
    </div>
  );
}
