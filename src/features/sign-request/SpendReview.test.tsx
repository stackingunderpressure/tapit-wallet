import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Wallet } from 'tapit-attest';
import { SpendReview } from './SpendReview.tsx';
import { readVaultMembership } from './vaultTrail.ts';
import fixture from './fixtures/fresh-address-vault.json';

const view = (extra: Record<string, string>) => {
  const w = Wallet.fromKeypair({ privateKey: fixture.tapit_private_key, publicKey: fixture.tapit_public_key });
  return readVaultMembership(w.attest({
    kind: 'agreement', tier: 'high_stakes', subject: fixture.vault_descriptor,
    fields: { agreement_type: 'vault-membership', vault_descriptor: fixture.vault_descriptor, vault_name: 'My Vault', role: 'everyday', leaf_scripts: JSON.stringify(fixture.leaf_scripts), ...extra },
  }));
};

describe('SpendReview', () => {
  it('a wellness-check member sees no money at all', () => {
    const html = renderToStaticMarkup(<SpendReview psbtHex={fixture.psbt_hex} membership={view({ change_scripts: JSON.stringify(fixture.change_scripts) })} />);
    expect(html).toBe('');
  });

  it('a full-details member sees what leaves, where, the checked change, and the fee', () => {
    const html = renderToStaticMarkup(<SpendReview psbtHex={fixture.psbt_hex} membership={view({ review_mode: 'full', network: 'signet', change_scripts: JSON.stringify(fixture.change_scripts) })} />);
    expect(html).toContain('Leaving the vault');
    expect(html).toContain('tb1p');
    expect(html).toContain("checked: the vault&#x27;s own change address");
    expect(html).toContain('Network fee');
  });

  it('everyone sees the warning when the change does not come back', () => {
    const html = renderToStaticMarkup(<SpendReview psbtHex={fixture.psbt_hex} membership={view({ change_scripts: JSON.stringify(fixture.receive_scripts) })} />);
    expect(html).toContain('This wallet will not sign it');
  });
});
