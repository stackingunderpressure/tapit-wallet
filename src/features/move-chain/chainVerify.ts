import { verifyEnvelope, type Attestation, type SuccessionLink } from 'tapit-attest';
import { base64UrlEncode } from '../../shared/lib/base64url.ts';
import { moveLink, readMoveMeta, resolveActiveKeys } from './moveChain.ts';

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
  /** false when every move's `anchor` was stripped to keep the bundle
   *  small — the moves may still be genuinely anchored; this proof just
   *  doesn't carry the (often large) OTS proof blobs to show it. Read
   *  this rather than a missing `anchor` field alone, so a verifier never
   *  reads "not anchored" when the truth is "not included here." */
  anchorsIncluded: boolean;
  chain: Attestation[];
  /** The owner's key-succession chain, if it's ever rotated — lets a
   *  stranger verifier independently confirm a move signed by a ROTATED
   *  key still genuinely belongs to this owner, the same way
   *  verifyMoveChain does, rather than trusting an unprovable claim. Empty
   *  when the owner has never rotated. */
  succession: SuccessionLink[];
}

// A whole chain carries every move's full claim + signatures (no pruning —
// a move has nothing sensitive to hide), heavier per move than a single
// disclosure proof, and an anchored move's `anchor.proof` — the OTS Merkle
// path + calendar attestations, opaque hex — commonly dwarfs everything
// else in that move by itself. Stripping anchors (the default; see
// includeAnchors below) keeps the bundle to roughly the size of the claim +
// signature alone, which stays well within a Nostr note; carrying every
// anchor blob can blow past what's reasonable to inline OR to dump as a
// pasteable block in the note (a real risk: oversized events get rejected
// by many relays outright). This budget is sized for the anchors-stripped
// default; a caller who opts into includeAnchors should expect the
// non-inline fallback far more often on any chain with real anchors.
export const CHAIN_INLINE_URL_BYTE_BUDGET = 5_000;

export interface MintedChainVerify {
  /** The proof bundle as canonical JSON (for copy / paste-into-/verify). */
  json: string;
  /** Either /verify?p=<base64url> (one-tap) or a bare /verify. */
  verifyUrl: string;
  /** True when the proof rode inline in the URL. */
  urlIsInline: boolean;
  /** Mirrors ChainProofBundle.anchorsIncluded. */
  anchorsIncluded: boolean;
}

/**
 * Build the whole-chain proof + verify URL for a run's full move chain.
 * Anchors are stripped by default (see the size note above) — a share note
 * should almost always use the default, since the note claiming "anchored
 * to Bitcoin" is already true independent of whether this particular proof
 * carries the (large) OTS blobs proving it. Pass includeAnchors: true only
 * for an explicit, separate "full proof" action, never the default share.
 */
export function buildChainVerifyUrl(
  chain: readonly Attestation[],
  opts: { includeAnchors?: boolean; succession?: readonly SuccessionLink[] } = {},
): MintedChainVerify {
  const includeAnchors = opts.includeAnchors ?? false;
  const strippedChain = includeAnchors
    ? [...chain]
    : chain.map((att) => {
        if (!att.anchor) return att;
        const { anchor: _anchor, ...rest } = att;
        return rest as Attestation;
      });
  const bundle: ChainProofBundle = {
    v: 1,
    kind: CHAIN_PROOF_KIND,
    anchorsIncluded: includeAnchors,
    chain: strippedChain,
    succession: [...(opts.succession ?? [])],
  };
  const json = JSON.stringify(bundle);
  const encoded = base64UrlEncode(json);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const inlineUrl = `${origin}/verify?p=${encoded}`;
  const urlIsInline = inlineUrl.length <= CHAIN_INLINE_URL_BYTE_BUDGET;
  return {
    json,
    verifyUrl: urlIsInline ? inlineUrl : `${origin}/verify`,
    urlIsInline,
    anchorsIncluded: includeAnchors,
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
  /** 'not_included' means anchor data was stripped from this proof (see
   *  ChainProofBundle.anchorsIncluded) — the move may still genuinely be
   *  anchored, this proof just can't show it. Distinct from 'none', which
   *  means the proof DID carry anchor data and there genuinely isn't one. */
  anchor: 'none' | 'pending' | 'confirmed' | 'not_included';
}

/**
 * Narrate a chain step by step for a reader — the "how it's possible"
 * view: each move's kind, price, date, whether its signature checks out,
 * and whether it genuinely links to the move before it. Purely descriptive;
 * the trusted pass/fail verdict for the WHOLE chain is verifyMoveChain's,
 * called separately by the caller against the same bundle.chain.
 * `anchorsIncluded` should mirror the bundle this chain came from (default
 * true for older proofs minted before that field existed, which always
 * carried anchors) — it's what lets step.anchor distinguish "not included
 * in this proof" from "genuinely not anchored." `succession`, if the owner
 * has ever rotated keys, lets a move signed by a rotated-to key still
 * report sigValid — resolved via the exact same resolveActiveKeys
 * verifyMoveChain itself uses, never a looser or different check.
 */
export interface DescribeChainOpts {
  /** Mirror the bundle's own `anchorsIncluded`. Default true — proofs minted
   *  before that field existed always carried anchors. */
  anchorsIncluded?: boolean;
  /** The owner's succession chain, so a move signed by a rotated-to key still
   *  reports sigValid. Omit and a post-rotation move reads as unsigned. */
  succession?: readonly SuccessionLink[];
}

export function describeChainSteps(
  chain: readonly Attestation[],
  opts: DescribeChainOpts = {},
): ChainStepView[] {
  // NAMED, not positional, and deliberately so. The old signature was
  // (chain, anchorsIncluded = true, succession = []) — a boolean sandwiched
  // before an array. Swap the last two and every move reports sigValid=false
  // while verifyMoveChain says the chain is fine: the exact "signature X on
  // every move, links all passing" symptom this repo has already chased down
  // twice (a case-sensitivity bug, then the missing succession-awareness).
  // Silently reporting a good chain as forged is the worst failure this
  // function has, so the shape now makes the mistake unspellable, and the
  // guard below catches it in untyped callers where tsc cannot.
  if (Array.isArray(opts) || typeof opts === 'boolean') {
    throw new TypeError(
      'describeChainSteps(chain, { anchorsIncluded, succession }) — the second ' +
        'argument is now an options object, not a positional flag or succession array.',
    );
  }
  const { anchorsIncluded = true, succession = [] } = opts;
  const steps: ChainStepView[] = [];
  const activeKeys = chain.length > 0 ? resolveActiveKeys(chain[0]!.subject, succession) : new Set<string>();
  for (let i = 0; i < chain.length; i++) {
    const att = chain[i]!;
    const meta = readMoveMeta(att);
    const v = verifyEnvelope(att);
    const sigValid = v.valid && v.signers.some((s) => s.valid && activeKeys.has(s.signer.toLowerCase()));
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
      anchor: att.anchor ? att.anchor.status : anchorsIncluded ? 'none' : 'not_included',
    });
  }
  return steps;
}
