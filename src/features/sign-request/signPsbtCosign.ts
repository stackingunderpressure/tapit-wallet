import type { Attestation, Wallet } from 'tapit-attest';
import {
  fromHex,
  toHex,
  parsePsbt,
  serializePsbt,
  tapLeafHash,
  tapscriptSighash,
} from '@dynastytrust/bip341-psbt-signer';
import {
  findVaultTrail,
  isKnownLeafScript,
  requiresCallbackConfirmation,
} from './vaultTrail.ts';
import type { PsbtCosignSignRequest } from './types.ts';

// The core of Cut B's psbt-cosign intent — pure, no hold, no anchoring, no
// redirect, so it can be unit-tested directly (same reasoning as
// coSignEnvelope.ts for the cosign-existing intent). approveRequest.ts
// wraps this with the grant-building + window.location redirect.
//
// Every check here is the wallet's OWN verification, never delegated to
// the caller (risk register: "no rogue signing... the human tap is the
// last gate, not the only gate; the wallet does its own verification
// first"):
//   1. A verified vault-membership trail this wallet itself signed must
//      exist for the claimed vault. No trail, no signature -- ever.
//   2. Above the trail's configured threshold (or ALWAYS, if no threshold
//      is declared -- fail-closed), the caller must have already
//      confirmed the out-of-band callback ritual.
//   3. Only an input whose tapLeafScript BYTE-MATCHES a script this
//      wallet was told about in the trail gets signed, regardless of
//      what the request's vault_context claims.

export class PsbtCosignError extends Error {
  constructor(
    public readonly code: 'no_vault_trail' | 'callback_required' | 'unknown_leaf_script',
    message: string,
  ) {
    super(message);
  }
}

export function signPsbtCosign(
  wallet: Wallet,
  holdings: readonly Attestation[],
  request: PsbtCosignSignRequest,
  calloutConfirmed: boolean,
): string {
  const trail = findVaultTrail(
    holdings,
    request.vault_context.vault_descriptor,
    wallet.publicKey,
  );
  if (!trail) {
    throw new PsbtCosignError(
      'no_vault_trail',
      'No verified vault-membership trail for this vault. Refusing to sign — this wallet does not recognize this vault.',
    );
  }

  const parsed = parsePsbt(request.psbt_hex);
  const totalOutSats = parsed.tx.outputs.reduce((sum, o) => sum + o.amount, 0n);
  if (requiresCallbackConfirmation(trail, totalOutSats) && !calloutConfirmed) {
    throw new PsbtCosignError(
      'callback_required',
      'This spend requires the out-of-band callback confirmation before signing.',
    );
  }

  const myXOnly = wallet.publicKey.toLowerCase();
  const myXOnlyBytes = fromHex(wallet.publicKey);
  let signedAny = false;

  for (let i = 0; i < parsed.inputs.length; i++) {
    const inp = parsed.inputs[i];
    if (!inp || !inp.tapLeafScript) continue;
    for (const leaf of inp.tapLeafScript) {
      const scriptHex = toHex(leaf.script);
      // Our key must actually appear in the script AND the script must be
      // one this wallet was told about at vault-creation time — the
      // vault_descriptor label alone is never sufficient.
      if (!scriptHex.toLowerCase().includes(myXOnly)) continue;
      if (!isKnownLeafScript(trail, scriptHex)) continue;

      const leafHash = tapLeafHash(leaf.script, leaf.leafVersion);
      const sighash = tapscriptSighash(parsed, i, leafHash, 0x00);
      const sig = fromHex(wallet.signDigest(sighash));

      if (!inp.tapScriptSigs) inp.tapScriptSigs = [];
      inp.tapScriptSigs = inp.tapScriptSigs.filter(
        (s) => !(toHex(s.pubkey) === myXOnly && toHex(s.leafHash) === toHex(leafHash)),
      );
      inp.tapScriptSigs.push({ pubkey: myXOnlyBytes, leafHash, sig });
      signedAny = true;
    }
  }

  if (!signedAny) {
    throw new PsbtCosignError(
      'unknown_leaf_script',
      'This key is not a known signer for any recognized leaf in this transaction. Refusing to sign.',
    );
  }

  return serializePsbt(parsed);
}
