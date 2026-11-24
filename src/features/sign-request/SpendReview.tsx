import { bech32, bech32m } from '@scure/base';
import { fromHex, parsePsbt } from '@dynastytrust/bip341-psbt-signer';
import type { VaultMembershipView } from './vaultTrail.ts';
import { changeProblem, spendOutputs } from './spendOutputs.ts';

// What a co-signer in "full details" mode sees before signing (DynastyTrust
// docs/tapit-review-modes-build-note.md; operator, 2026-11-24: "option for
// a vault builder to choose blind transactions and only need the wellness
// check part of relationship. Both options available"). A wellness-check
// member sees none of this -- only the change warning, because their
// wallet will refuse that spend either way.

function addressOf(scriptHex: string, network: VaultMembershipView['network']): string {
  const hrp = network === 'bitcoin' ? 'bc' : 'tb';
  const s = fromHex(scriptHex);
  if (s.length === 34 && s[0] === 0x51 && s[1] === 0x20) return bech32m.encode(hrp, [1, ...bech32m.toWords(s.slice(2))]);
  if ((s.length === 22 && s[0] === 0x00 && s[1] === 0x14) || (s.length === 34 && s[0] === 0x00 && s[1] === 0x20)) {
    return bech32.encode(hrp, [0, ...bech32.toWords(s.slice(2))]);
  }
  return `script ${scriptHex}`;
}

const sats = (n: bigint) => `${n.toLocaleString()} sats`;

export function SpendReview({ psbtHex, membership }: { psbtHex: string; membership: VaultMembershipView }) {
  let psbt;
  try {
    psbt = parsePsbt(psbtHex);
  } catch {
    return null;
  }
  const problem = changeProblem(psbt, membership.changeScripts);
  const warning = problem && (
    <div className="mt-3 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-900">
      {problem} This wallet will not sign it. Tell the person on the call.
    </div>
  );
  if (membership.reviewMode !== 'full') return warning || null;

  const outs = spendOutputs(psbt, membership.changeScripts);
  const leaving = outs.filter((o) => !o.backToVault);
  const back = outs.filter((o) => o.backToVault);
  const totalIn = psbt.inputs.reduce((n, i) => n + (i.witnessUtxo?.amount ?? 0n), 0n);
  const totalOut = outs.reduce((n, o) => n + o.amountSats, 0n);
  const knownIn = psbt.inputs.every((i) => i.witnessUtxo);
  const leavingSats = leaving.reduce((n, o) => n + o.amountSats, 0n);
  return (
    <div className="mt-3 rounded-md border border-ink/15 bg-paper p-4 text-sm">
      <div className="font-medium">What this spend does</div>
      <div className="mt-2">Leaving the vault: <span className="font-medium">{sats(leavingSats)}</span></div>
      {leaving.map((o) => (
        <div key={o.index} className="mt-1 text-xs break-all">
          {sats(o.amountSats)} to <span className="font-mono">{addressOf(o.scriptHex, membership.network)}</span>
        </div>
      ))}
      {back.length > 0 && (
        <div className="mt-2">
          Coming back to the vault: <span className="font-medium">{sats(back.reduce((n, o) => n + o.amountSats, 0n))}</span>
          <span className="text-xs text-muted"> (checked: the vault's own change address)</span>
        </div>
      )}
      {!membership.changeScripts.length && (
        <div className="mt-2 text-xs text-muted">
          This wallet has no list of the vault's change addresses yet, so it cannot tell change from a payment. Ask for the membership to be sent again.
        </div>
      )}
      {knownIn && <div className="mt-2 text-xs text-muted">Network fee: {sats(totalIn - totalOut)}</div>}
      <div className="mt-2 text-xs text-muted">
        Ask them on the call where it is going. Your wallet checks the change, but only they know who they meant to pay.
      </div>
      {warning}
    </div>
  );
}
