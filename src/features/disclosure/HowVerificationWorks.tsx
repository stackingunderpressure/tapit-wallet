import { useState } from 'react';

// The teaching surface for the public /verify page (operator idea
// 2026-06-03). A wallet-less visitor who clicked "verify the math"
// should not just see a green "valid" badge — they should learn HOW the
// guarantee works, in plain language, so they walk away trusting the
// math instead of trusting this site. This component renders the
// three-step explanation of what verification actually checks, with the
// real values from the proof they just ran threaded in so the teaching
// is concrete, not abstract.
//
// Honest scope note: the proof bundle today carries the signed envelope
// (digest + Merkle steps + signatures) but NOT the Bitcoin anchor — the
// Anchor (where btcHeight lives) is not part of DisclosureMeta or either
// bundle shape. So this surface teaches the three things verification
// genuinely proves right now — the fingerprint, the Merkle re-derivation
// from only the disclosed fields, and the signature — and is honest that
// the Bitcoin timestamp is a separate, not-yet-included layer rather than
// claiming a block link the bundle can't back. When the bundle is
// extended to carry the anchor, a fourth step slots in here.

interface Props {
  /** The canonical envelope digest the verifier recomputed, hex. */
  digest: string;
  /** How many leaves the proof disclosed. */
  disclosedCount: number;
  /** Whether the proof verified — tunes the closing line. */
  valid: boolean;
  /** Signer pubkeys (x-only hex) the signature check ran against. */
  signers: { signer: string; valid: boolean }[];
}

function shortHex(s: string): string {
  if (s.length <= 20) return s;
  return `${s.slice(0, 10)}…${s.slice(-6)}`;
}

export function HowVerificationWorks({
  digest,
  disclosedCount,
  valid,
  signers,
}: Props) {
  const [open, setOpen] = useState(false);
  const signerCount = signers.length;

  return (
    <section className="mt-4 rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="text-sm font-medium text-ink">
          How do you know this is true? (without trusting this page)
        </span>
        <span aria-hidden className="shrink-0 text-muted">
          {open ? '−' : '+'}
        </span>
      </button>

      {open && (
        <div className="mt-4 space-y-4 text-sm text-ink/80">
          <p>
            You do not have to trust this website, the person who sent you
            this proof, or the Tapit app. The check below is pure math that
            runs on your own device, in your browser, right now. Here is
            exactly what it did, in three steps.
          </p>

          <ol className="space-y-4">
            <li>
              <div className="font-medium text-ink">
                1. It rebuilt the fingerprint from only what you can see.
              </div>
              <p className="mt-1">
                Every signed entry commits to a single fingerprint (a hash)
                computed from all of its fields, arranged as a Merkle tree —
                a structure where each fact is hashed, pairs of hashes are
                hashed together, and so on up to one root hash. This proof
                revealed{' '}
                {disclosedCount === 1
                  ? 'one field'
                  : `${disclosedCount} fields`}{' '}
                to you and replaced everything that stayed private with just
                its hash. Your browser walked those hashes back up the tree
                and recomputed the root.
              </p>
            </li>

            <li>
              <div className="font-medium text-ink">
                2. It matched that fingerprint to what was signed.
              </div>
              <p className="mt-1">
                The root your browser just rebuilt is this:
              </p>
              <p className="mt-1 break-all rounded bg-ink/[0.04] px-2 py-1 font-mono text-xs">
                {shortHex(digest)}
              </p>
              <p className="mt-1">
                If even one character of any revealed field had been changed,
                this fingerprint would come out different and the next step
                would fail. That is what makes the revealed fields
                tamper-evident — you can trust them without seeing the
                private ones, because changing them breaks the math.
              </p>
            </li>

            <li>
              <div className="font-medium text-ink">
                3. It checked the signature over that fingerprint.
              </div>
              <p className="mt-1">
                {signerCount === 1
                  ? "One key signed this fingerprint."
                  : `${signerCount} keys signed this fingerprint.`}{' '}
                A BIP-340 Schnorr signature (the same signature scheme
                Bitcoin uses) proves the holder of a specific private key
                signed this exact fingerprint — and only the matching public
                key, shown on this page, can have produced it. Your browser
                checked the signature against that public key.{' '}
                {valid
                  ? 'It matched — which is why the panel above is green.'
                  : 'It did not match — which is why the panel above is red.'}
              </p>
            </li>
          </ol>

          <p className="rounded-md border border-ink/10 bg-ink/[0.02] px-3 py-2 text-xs text-muted">
            Want to see it for yourself? Verify a proof once to get green,
            then change a single character of any value in the proof text and
            verify again — the panel flips to red instantly. The math is the
            authority here, not us.
          </p>

          <p className="text-xs text-muted">
            There is a fourth thing some proofs carry: an independent Bitcoin
            timestamp proving roughly <em>when</em> the entry existed. When a
            proof includes one, you'll see a "Bitcoin timestamp" line above
            with the block it was anchored to — and the page re-checks that
            the timestamp genuinely belongs to <em>this</em> entry before
            showing it, so it can't be faked by whoever shared the proof. If
            no such line appears, this proof simply doesn't carry a timestamp —
            the signature check above still stands on its own.
          </p>
        </div>
      )}
    </section>
  );
}
