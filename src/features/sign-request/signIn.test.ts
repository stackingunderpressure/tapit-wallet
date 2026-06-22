import { describe, it, expect } from 'vitest';
import { schnorr } from '@noble/curves/secp256k1';
import {
  Wallet,
  answerSignInChallenge,
  buildSignInChallenge,
  signInDigestFor,
  verifySignIn,
  type SignInAttestation,
} from 'tapit-attest';

// Sign-in by attestation, the wallet-side proof. The whole point of this
// cut is that the wallet answers a login challenge WITHOUT ever exposing its
// private key: it computes the exact digest via signInDigestFor() and signs
// it through wallet.signDigest(). These tests prove that path produces an
// attestation byte-equivalent in verifiability to answerSignInChallenge()
// (which takes a raw key) — i.e. the exposed digest helper matches the
// library's internal digest exactly. If signInDigestFor ever drifted from
// the internal signInDigest, the wallet-signed attestation would fail
// verifySignIn while the raw-key one passed, and this test would catch it.

// Mirror the approval-path mechanism: hex pubkey + signInDigestFor + signDigest.
function walletAnswer(wallet: Wallet, challenge: ReturnType<typeof buildSignInChallenge>): SignInAttestation {
  const base = {
    v: 1 as const,
    challenge,
    signer: wallet.publicKey,
    issuedAt: new Date().toISOString(),
  };
  const signature = wallet.signDigest(signInDigestFor(base));
  return { ...base, signature };
}

describe('sign-in via wallet.signDigest (no raw key)', () => {
  it('the wallet-signed attestation passes verifySignIn against the same challenge', () => {
    const wallet = Wallet.generate();
    const challenge = buildSignInChallenge({ audience: 'dynastytrust.family' });

    const attestation = walletAnswer(wallet, challenge);

    const result = verifySignIn({ attestation, expectedChallenge: challenge });
    expect(result.valid).toBe(true);
    expect(result.signer).toBe(wallet.publicKey);
    expect(result.errors).toEqual([]);
  });

  it('proves the exposed digest matches the internal one: both paths verify for the same key', () => {
    // Derive a private key, build a wallet from it, and answer the SAME
    // challenge two ways: via answerSignInChallenge (raw key, internal digest)
    // and via signInDigestFor + signDigest (the wallet path). Both must pass
    // verifySignIn against the issued challenge, which is only possible if the
    // exposed helper computes the identical digest bytes the library signs.
    const priv = schnorr.utils.randomPrivateKey();
    const privHex = Array.from(priv)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const wallet = Wallet.fromKeypair({
      publicKey: Array.from(schnorr.getPublicKey(priv))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(''),
      privateKey: privHex,
    });
    const challenge = buildSignInChallenge({ audience: 'app.example' });

    const viaRawKey = answerSignInChallenge({ challenge, signerPrivateKey: privHex });
    const viaWallet = walletAnswer(wallet, challenge);

    // Same signer key in both.
    expect(viaWallet.signer).toBe(viaRawKey.signer);

    // Both independently verify against the issued challenge — the proof the
    // signInDigestFor helper bytes equal the internal signInDigest bytes.
    expect(verifySignIn({ attestation: viaRawKey, expectedChallenge: challenge }).valid).toBe(true);
    expect(verifySignIn({ attestation: viaWallet, expectedChallenge: challenge }).valid).toBe(true);
  });

  it('a tampered challenge echo fails the verifier (anti-replay still holds)', () => {
    const wallet = Wallet.generate();
    const issued = buildSignInChallenge({ audience: 'app.example' });
    const attestation = walletAnswer(wallet, issued);

    // Verifier checks against a DIFFERENT challenge than the one signed.
    const other = buildSignInChallenge({ audience: 'app.example' });
    const result = verifySignIn({ attestation, expectedChallenge: other });
    expect(result.valid).toBe(false);
  });
});
