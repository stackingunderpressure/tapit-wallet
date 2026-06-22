// Education content module — the catalog behind sovereignty-literacy-
// through-use (TW-1). One place every teaching concept lives, in three
// honest tiers: a plain-English `consequence` (what this does FOR you,
// jargon-free), a middle `whyItWorks` tier (the mechanism in everyday
// words), and a deepest `theCrypto` tier where the real names are allowed
// so a curious person can go look the primitive up. This generalizes the
// scattered teaching content (recovery/secretLiteracy, family-tree/
// kinEducation) into a shared catalog ExplainChip can read from anywhere.
//
// The discipline that makes this trustworthy is the jargon-guard: the
// `consequence` string of every guarded lesson is asserted (in
// literacy.test.ts) to be free of crypto jargon, the same rule
// secretLiteracy already lives by. The mechanism names earn their place
// only in `theCrypto`.

import { explainThreshold, LEAK_VS_LOSS } from '../recovery/secretLiteracy.ts';

export interface LessonContent {
  /** Stable id, matches the catalog key and the ExplainChip `concept` prop. */
  slug: string;
  /** Plain English: what this does FOR the user. Jargon-free (guarded). */
  consequence: string;
  /** Middle tier: the mechanism in everyday words. Optional. */
  whyItWorks?: string;
  /** Deepest tier: the real primitive named, jargon allowed. Optional. */
  theCrypto?: string;
  /** A question that invites the user to reason it out for themselves. */
  socraticQuestion?: string;
  /** The "aha" the lesson is trying to land — the moment of understanding. */
  ahaTrigger?: string;
  /** Set false to opt a lesson out of the consequence jargon-guard. */
  jargonGuarded?: boolean;
}

export const LESSONS: Record<string, LessonContent> = {
  'leak-vs-loss': {
    slug: 'leak-vs-loss',
    // Reuses the recovery teaching string verbatim — one source of truth.
    consequence: LEAK_VS_LOSS,
    whyItWorks:
      'Splitting a secret into pieces only helps when the danger is ' +
      'someone seeing it. If the only danger is losing it, copies in safe ' +
      'hands solve that better than splitting it ever could.',
    theCrypto:
      'Secret sharing protects confidentiality (a leak) by ensuring no ' +
      'single piece reveals anything. It does nothing extra for ' +
      'availability (a loss) beyond plain redundancy, so the leak-vs-loss ' +
      'gut check tells you whether you actually need a split at all.',
    socraticQuestion:
      'Would it hurt if one trusted person saw this — or only if you lost it?',
    ahaTrigger:
      'Not everything worth keeping needs splitting; pick the tool to the danger.',
  },

  'threshold': {
    slug: 'threshold',
    // explainThreshold is already jargon-clean (its own guard test proves
    // it). An illustrative 3-of-5 keeps the example concrete on screen.
    consequence: explainThreshold(5, 3),
    whyItWorks:
      'You decide how many of your chosen people it takes to put a secret ' +
      'back together. Fewer needed means easier to recover but easier for a ' +
      'few to act without you; more needed means safer from any small group ' +
      'but you must be able to reach more of them.',
    theCrypto:
      'This is an M-of-N threshold scheme (Shamir secret sharing over ' +
      'GF(256)): any M of the N shares reconstruct the secret and any ' +
      'M-minus-one reveal nothing about it.',
    socraticQuestion:
      'How many of your people should it take — and can you actually reach that many?',
    ahaTrigger:
      'Safety and reachability pull against each other; you get to set the balance.',
  },

  'web-of-trust': {
    slug: 'web-of-trust',
    consequence:
      'Instead of one company deciding who is real, the people you have ' +
      'met in person vouch for each other. Trust grows from real ' +
      'relationships you can see, not from a badge a stranger handed out.',
    whyItWorks:
      'When you meet someone face to face and confirm who they are, your ' +
      'wallet remembers it. Their confirmations and yours overlap, and a ' +
      'web forms where each link is a real-world meeting rather than a ' +
      'claim on a screen.',
    theCrypto:
      'This is a web-of-trust: each in-person confirmation is a signed ' +
      'attestation binding a person to their public key, and trust is ' +
      'computed transitively across the graph of those signatures rather ' +
      'than delegated to a central certificate authority.',
    socraticQuestion:
      'Whose word would you actually take that a stranger is who they claim?',
    ahaTrigger:
      'Identity can come from your real relationships, not from a gatekeeper.',
  },

  'anchor-proof': {
    slug: 'anchor-proof',
    consequence:
      'You can prove something existed at a certain time without telling ' +
      'anyone what it was. Later, no one can claim you wrote it earlier or ' +
      'later than you did — the proof of when is locked in.',
    whyItWorks:
      'Your wallet takes a fingerprint of the thing and stamps that ' +
      'fingerprint into a public record everyone shares. The record only ' +
      'ever moves forward in time, so the stamp pins down the moment ' +
      'without exposing the contents.',
    theCrypto:
      'This is OpenTimestamps anchoring: a hash of the data is committed ' +
      'into a Bitcoin transaction, so the block height and timestamp give ' +
      'a tamper-evident proof-of-existence at or before that block.',
    socraticQuestion:
      'How would you prove you knew something first, without revealing it yet?',
    ahaTrigger:
      'Time itself can be witnessed and proven, privately.',
  },

  'verify-on-bitcoin': {
    slug: 'verify-on-bitcoin',
    consequence:
      'Anyone you share a proof with can check it themselves, on their own ' +
      'device, without trusting this app or any website. Change a single ' +
      'character of what was proven and the check fails on the spot.',
    whyItWorks:
      'The proof carries the math needed to re-derive a fingerprint from ' +
      'only the parts you chose to reveal. If everything lines up, the ' +
      'fingerprint matches what was signed and stamped; if anything was ' +
      'altered, it no longer matches and the answer turns red.',
    theCrypto:
      'Verification recomputes the Merkle root from the disclosed leaves, ' +
      'checks the BIP-340 Schnorr signature over that root, and (when ' +
      'present) confirms the Bitcoin anchor commits to the same digest — ' +
      'all client-side, trusting only the math and the chain.',
    socraticQuestion:
      'What would let you believe a claim is true without trusting whoever sent it?',
    ahaTrigger:
      'The math is the authority — you never have to trust the messenger.',
  },

  'recovery-cohort': {
    slug: 'recovery-cohort',
    consequence:
      'You pick the people who could help you get back in if you lose your ' +
      'device. No one of them can do it alone, and you choose how many it ' +
      'takes — so you are never one lost phone away from losing everything.',
    whyItWorks:
      'Your wallet hands each chosen helper a piece. Getting back in needs ' +
      'enough of those pieces brought together, which means you trust the ' +
      'group as a whole rather than betting everything on one person or one ' +
      'backup.',
    theCrypto:
      'The recovery cohort is an M-of-N Shamir split of the backup ' +
      'encryption key (never the signing key); recovery combines M shares ' +
      'to rebuild that key and decrypt the backup on a fresh device.',
    socraticQuestion:
      'Which people would you actually trust to help you back in — and how many?',
    ahaTrigger:
      'Losing a device should never mean losing yourself.',
  },

  'keys-custody': {
    slug: 'keys-custody',
    consequence:
      'Your keys live only on your own device, and only you can unlock ' +
      'them. No company holds them, no one can freeze them, and no one can ' +
      'act as you without your say-so. This is what owning it really means.',
    whyItWorks:
      'When you set up the wallet it creates a secret that never leaves ' +
      'your device unprotected. Even the parts that sync are scrambled so ' +
      'that the only thing a server ever sees is a locked box it cannot ' +
      'open.',
    theCrypto:
      'Self-custody: the private key is generated on-device and stored ' +
      'encrypted (AES-GCM via a PBKDF2-derived key); sync hosts only ever ' +
      'see ciphertext, and signing happens locally so the secret is never ' +
      'transmitted.',
    socraticQuestion:
      'If a company can hold your keys for you, who really owns them?',
    ahaTrigger:
      'Holding your own keys is the whole point — it is yours, finally.',
  },

  'witness-cosign': {
    slug: 'witness-cosign',
    consequence:
      'You can ask people you trust to add their stamp to something ' +
      'important, so it carries more than just your word. An agreement ' +
      'signed by several people is far harder to dispute later.',
    whyItWorks:
      'Each person who agrees adds their own confirmation over the exact ' +
      'same thing. Anyone checking it later can see every confirmation ' +
      'lines up with the unchanged original, so the more witnesses, the ' +
      'stronger it stands.',
    theCrypto:
      'Co-signing collects multiple BIP-340 Schnorr signatures over one ' +
      'shared envelope digest; each signature independently binds a ' +
      'signer to the exact bytes, so tampering invalidates every one of ' +
      'them at once.',
    socraticQuestion:
      'Whose signature alongside yours would make an agreement undeniable?',
    ahaTrigger:
      'Many honest witnesses turn your word into something that holds.',
  },
};
