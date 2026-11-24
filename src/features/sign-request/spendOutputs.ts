import { toHex, type ParsedPsbt } from '@dynastytrust/bip341-psbt-signer';

// What a spend does with the money, read from the PSBT and checked against
// the vault's own change addresses in this wallet's signed membership
// (DynastyTrust docs/tapit-review-modes-build-note.md).

export interface SpendOutput {
  index: number;
  amountSats: bigint;
  scriptHex: string;
  /** True when the output is one of the vault's own change addresses. */
  backToVault: boolean;
  /** True when the PSBT marks the output as the vault's own (it carries
   *  the vault's key derivations) -- a claim, checked by changeProblem. */
  claimsVault: boolean;
}

export function spendOutputs(psbt: ParsedPsbt, changeScripts: readonly string[]): SpendOutput[] {
  const own = new Set(changeScripts.map((s) => s.toLowerCase()));
  return psbt.tx.outputs.map((o, index) => {
    const scriptHex = toHex(o.scriptPubkey).toLowerCase();
    return {
      index,
      amountSats: o.amount,
      scriptHex,
      backToVault: own.has(scriptHex),
      claimsVault: (psbt.outputMaps?.[index]?.tapBip32Derivation?.length ?? 0) > 0,
    };
  });
}

/**
 * Why this spend's change cannot be trusted, or null. An output that the
 * PSBT presents as the vault's own change but that is NOT one of the
 * vault's change addresses is the money quietly leaving while looking like
 * it came back. A membership without a change list (accepted before
 * 2026-11-24) skips the check -- the operator's choice -- until resent.
 */
export function changeProblem(psbt: ParsedPsbt, changeScripts: readonly string[]): string | null {
  if (!changeScripts.length) return null;
  const bad = spendOutputs(psbt, changeScripts).filter((o) => o.claimsVault && !o.backToVault);
  if (!bad.length) return null;
  return bad.length === 1
    ? `Output ${bad[0]!.index + 1} is presented as this vault's change, but it is not one of the vault's own addresses.`
    : `${bad.length} outputs are presented as this vault's change, but are not the vault's own addresses.`;
}
