import { verifyEnvelope, type Attestation } from 'tapit-attest';
import { base64UrlEncode } from '../../shared/lib/base64url.ts';
import { moveLink, readMoveMeta } from './moveChain.ts';

// chainVerify — lets a stranger verify a WHOLE move chain, genesis through
// the latest move, not just one disclosed move. Unlike disclosure's pruned
// Merkle proofs (built for hiding most of a claim), a move has nothing
// sensitive to hide — it's a public game move — so the proof bundle is just
// the chain's own full, already-signed attestations. verifyMoveChain
// (moveChain.ts) is the trusted all-or-nothing verdict; describeChainSteps
// here re-derives the SAME per-move checks (verifyEnvelope, moveLink) purely
// for narrating each step to a reader, never as a second source of truth.
//
// PURE. No wallet, no network, no Date.now() — buildChainVerifyUrl reads
// window.location.origin, the one DOM touch every /verify-link builder in
// this wallet already makes (see buildVerifyUrl.ts).

export const CHAIN_PROOF_KIND = 'move_chain' as const;

export interface ChainProofBundle {
  v: 1;
  kind: typeof CHAIN_PROOF_KIND;
  chain: Attestation[];
}

// A whole chain carries every move's full claim + signatures (no pruning —
// a move has nothing sensitive to hide), so it's much heavier per move than
// a single disclosure proof: measured ~800-900 bytes of JSON per move,
// ~1100 base64. Disclosure's 1800-byte budget (built for QR capacity and
// iMessage previews) would make even a 2-move run fall back immediately.
// This is a Nostr note, not a QR code, so the budget is looser — enough
// for genesis plus several real round trips to stay one-tap; past this the
// link falls back to a bare /verify and the caller should append the JSON
// as a pasteable block in the same note so the whole thing stays
// self-contained with no side channel needed to move the proof.
export const CHAIN_INLINE_URL_BYTE_BUDGET = 5_000;

export interface MintedChainVerify {
  /** The proof bundle as canonical JSON (for copy / paste-into-/verify). */
  json: string;
  /** Either /verify?p=<base64url> (one-tap) or a bare /verify. */
  verifyUrl: string;
  /** True when the proof rode inline in the URL. */
  urlIsInline: boolean;
}

/** Build the whole-chain proof + verify URL for a run's full move chain. */
export function buildChainVerifyUrl(chain: readonly Attestation[]): MintedChainVerify {
  const bundle: ChainProofBundle = { v: 1, kind: CHAIN_PROOF_KIND, chain: [...chain] };
  const json = JSON.stringify(bundle);
  const encoded = base64UrlEncode(json);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const inlineUrl = `${origin}/verify?p=${encoded}`;
  const urlIsInline = inlineUrl.length <= CHAIN_INLINE_URL_BYTE_BUDGET;
  return {
    json,
    verifyUrl: urlIsInline ? inlineUrl : `${origin}/verify`,
    urlIsInline,
  };
}

/**
 * Detect + shape-check a pasted/decoded chain proof bundle. Returns null
 * (never throws) for anything that isn't one, so a verifier page can try
 * this, then fall through to the disclosure-proof paths, the same
 * detect-and-fall-through pattern VerifyProofScreen already uses for a
 * gated-release bundle.
 */
export function parseChainProofBundle(raw: string): ChainProofBundle | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const p = parsed as Record<string, unknown>;
  if (p.v !== 1 || p.kind !== CHAIN_PROOF_KIND || !Array.isArray(p.chain)) return null;
  return p as unknown as ChainProofBundle;
}

export interface ChainStepView {
  seq: number;
  /** 'start' | 'sell' | 'buy' | whatever the idea's payload names it. */
  kind: string;
  price: number | null;
  whenIso: string | null;
  /** This move's own signature checks out, signed by its own subject. */
  sigValid: boolean;
  /** This move's prevHash equals the prior move's moveLink (true for a
   *  well-formed genesis, whose prevHash must be empty). */
  linkValid: boolean;
  anchor: 'none' | 'pending' | 'confirmed';
}

/**
 * Narrate a chain step by step for a reader — the "how it's possible"
 * view: each move's kind, price, date, whether its signature checks out,
 * and whether it genuinely links to the move before it. Purely descriptive;
 * the trusted pass/fail verdict for the WHOLE chain is verifyMoveChain's,
 * called separately by the caller against the same bundle.chain.
 */
export function describeChainSteps(chain: readonly Attestation[]): ChainStepView[] {
  const steps: ChainStepView[] = [];
  for (let i = 0; i < chain.length; i++) {
    const att = chain[i]!;
    const meta = readMoveMeta(att);
    const v = verifyEnvelope(att);
    const sigValid = v.valid && v.signers.some((s) => s.valid && s.signer === att.subject);
    const linkValid = meta
      ? i === 0
        ? meta.prevHash === ''
        : meta.prevHash === moveLink(chain[i - 1]!)
      : false;
    const kind = meta && typeof meta.payload.kind === 'string' ? meta.payload.kind : 'unknown';
    const price = meta && typeof meta.payload.price === 'number' ? meta.payload.price : null;
    const whenIso =
      meta && typeof meta.payload.price_time === 'string' ? meta.payload.price_time : att.issuedAt;
    steps.push({
      seq: meta ? meta.seq : i,
      kind,
      price,
      whenIso,
      sigValid,
      linkValid,
      anchor: att.anchor ? att.anchor.status : 'none',
    });
  }
  return steps;
}
