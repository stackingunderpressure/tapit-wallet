import { useState } from 'react';
import type { MoveChainResult } from '../move-chain/moveChain.ts';
import type { ChainStepView } from '../move-chain/chainVerify.ts';

// Renders a whole-chain verify outcome: genesis through the latest move,
// each one checked against the move before it. Sibling to
// HowVerificationWorks (the single-proof teaching surface) but for the
// hash-chain mechanism specifically — "built on the last hash" made
// legible step by step, not just a pass/fail badge.

interface Props {
  verdict: MoveChainResult;
  steps: ChainStepView[];
  anchorsIncluded: boolean;
}

function shortKey(s: string): string {
  if (s.length <= 16) return s;
  return `${s.slice(0, 8)}…${s.slice(-4)}`;
}

function fmtWhen(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtPrice(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '';
  return '$' + Math.round(n).toLocaleString();
}

export function ChainVerifyResult({ verdict, steps, anchorsIncluded }: Props) {
  const [howOpen, setHowOpen] = useState(false);

  return (
    <>
      <section
        className={`mt-4 rounded-2xl border p-5 shadow-sm ${
          verdict.valid ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
        }`}
      >
        <p className="text-sm font-medium">
          {verdict.valid
            ? 'This whole chain checks out — genesis through the latest move.'
            : 'This chain did NOT verify.'}
        </p>
        <p className={`mt-1 text-xs ${verdict.valid ? 'text-emerald-800' : 'text-red-800'}`}>
          {verdict.valid
            ? `Every one of the ${verdict.length} moves below is validly signed by the same owner, and each one genuinely links to the move before it, all the way back to the genesis.`
            : "At least one move isn't correctly signed, or its link to the move before it doesn't match — see the notes below."}
        </p>
        {verdict.owner && (
          <>
            <div className="mt-3 text-xs uppercase tracking-wide text-muted">Owner</div>
            <div className="mt-1 font-mono text-sm break-all">{shortKey(verdict.owner)}</div>
          </>
        )}

        {!anchorsIncluded && (
          <p className="mt-3 rounded-md border border-ink/10 bg-ink/[0.02] px-3 py-2 text-xs text-muted">
            This proof leaves out each move's Bitcoin-timestamp data to keep the link short — the
            signature and chain-link checks below don't need it. A move can still genuinely be
            anchored even though this particular proof can't show it.
          </p>
        )}

        <div className="mt-3 text-xs uppercase tracking-wide text-muted">
          Moves ({steps.length})
        </div>
        <ol className="mt-1 space-y-2">
          {steps.map((s) => (
            <li key={s.seq} className="rounded-md border border-ink/10 bg-white px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium capitalize">
                  {s.seq}. {s.kind}
                  {s.price != null && ` at ${fmtPrice(s.price)}`}
                </span>
                <span className="text-xs text-muted">{fmtWhen(s.whenIso)}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                <span>{s.sigValid ? '✓' : '✗'} signature</span>
                <span>{s.linkValid ? '✓' : '✗'} {s.seq === 0 ? 'genesis link' : 'linked to prior move'}</span>
                <span>
                  {s.anchor === 'confirmed' && '✓ Bitcoin-anchored'}
                  {s.anchor === 'pending' && '… anchor pending'}
                  {s.anchor === 'none' && 'not yet anchored'}
                  {s.anchor === 'not_included' && 'Bitcoin timestamp not included in this proof'}
                </span>
              </div>
            </li>
          ))}
        </ol>

        {verdict.errors.length > 0 && (
          <>
            <div className="mt-3 text-xs uppercase tracking-wide text-muted">Notes</div>
            <ul className="mt-1 space-y-0.5">
              {verdict.errors.map((e, i) => (
                <li key={i} className="text-xs text-muted">
                  {e}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="mt-4 rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
        <button
          type="button"
          onClick={() => setHowOpen((v) => !v)}
          aria-expanded={howOpen}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <span className="text-sm font-medium text-ink">
            How does one link prove the whole chain? (without trusting this page)
          </span>
          <span aria-hidden className="shrink-0 text-muted">
            {howOpen ? '−' : '+'}
          </span>
        </button>

        {howOpen && (
          <div className="mt-4 space-y-4 text-sm text-ink/80">
            <p>
              The genesis move — the first one, "0" above — starts with an empty link, because
              there was nothing before it. Every move after that stores the exact fingerprint of
              the move right before it, alongside its own price, date, and kind. That fingerprint
              is itself built from everything in that earlier move, which was in turn built from
              everything before it — so the last move's fingerprint depends on the entire history,
              not just its own fields.
            </p>
            <p>
              That means changing anything — a price, a date, deleting a move, swapping in a
              different one — changes that move's fingerprint, which breaks the link the next move
              was counting on, which breaks the one after that, all the way to the end. Your
              browser just walked the whole chain and recomputed every one of those links itself.
              A chain this long staying unbroken isn't something the owner could have faked after
              the fact — it can only happen by genuinely making each move in order, one at a time.
            </p>
            <p>
              Each move is separately signed too, by the same key every time — so on top of the
              chain holding together, every single move is individually provable to have come from
              one identity, not stitched together from someone else's.
            </p>
            <p className="rounded-md border border-ink/10 bg-ink/[0.02] px-3 py-2 text-xs text-muted">
              Want to see it break? Change one digit of one move's price in the proof text and
              verify again — every link from that move onward flips to a red ✗ instantly.
            </p>
          </div>
        )}
      </section>
    </>
  );
}
