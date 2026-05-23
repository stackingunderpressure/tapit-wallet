import { describe, it, expect } from 'vitest';
import {
  Wallet,
  combineShares,
  encryptRecoverable,
  decryptRecoverableWithKData,
  unwrapKData,
} from 'tapit-attest';
import { buildRecoveryShares } from './createShares.ts';
import {
  buildRecoveryRequestEnvelope,
  buildShareResponseEnvelope,
  decryptShareResponse,
  isRecoveryRequest,
  isShareResponse,
  readRecoveryRequest,
  readShareResponse,
} from './createRecoveryRequest.ts';
import type { CohortMember } from './createCohort.ts';

// Phase 5e-v/-vi/-vii end-to-end round-trip test. Walks the full
// ceremony in-process:
//
//   1. Operator wallet encrypts a snapshot in v2 (encryptRecoverable)
//      and extracts K_data.
//   2. Operator splits K_data and builds N recovery-share envelopes,
//      one per cohort member (existing 5e-iii-b-2 substrate).
//   3. Peers hold their share envelopes (simulated by just retaining
//      them in test scope).
//   4. The operator's device is gone (simulated by NOT having the
//      operator's keypair anymore — only the cloud blob remains).
//   5. A NEW device generates a ceremony Wallet, builds a
//      recovery-request envelope naming the old identity and the
//      ceremony pubkey, sends it to each cohort member.
//   6. Each cohort member receives the request, decrypts their held
//      share via the operator's signed envelope, re-encrypts the
//      raw bytes to the ceremony pubkey, signs a share-response
//      envelope and sends it back.
//   7. The ceremony wallet decrypts each response (NIP-44 unwrap)
//      back to a raw Share, then combines M of them via
//      combineShares into K_data, then decrypts the original cloud
//      blob via decryptRecoverableWithKData → original plaintext.
//
// If this end-to-end test passes, the math half of Phase 5e is
// proven. The remaining work is the UI choreography (modals +
// inbox routing) plus the recovery-succession event.

describe('recovery-request / share-response round-trip', () => {
  it('walks the full ceremony — request → responses → combine → decrypt blob', () => {
    // 1. Operator wallet + a backup blob, snapshot included for realism.
    const operator = Wallet.generate();
    const snapshotJson = JSON.stringify({ v: 'snapshot-fixture', secret: 'the real plaintext' });
    const { blob } = encryptRecoverable(snapshotJson, 'operators-passphrase');
    const kData = unwrapKData(blob, 'operators-passphrase');

    // 2. Five peers form the cohort; M=3.
    const peers = Array.from({ length: 5 }, () => Wallet.generate());
    const cohort: CohortMember[] = peers.map((p, i) => ({
      pubkey: p.publicKey,
      name: `Peer ${i + 1}`,
    }));
    const M = 3;

    // 3. Operator builds + signs share envelopes; peers "hold" them.
    const packages = buildRecoveryShares(operator, kData, cohort, M);
    expect(packages).toHaveLength(5);
    const heldByPeer = new Map(packages.map((p, i) => [peers[i]!.publicKey, p.envelope]));

    // 4. Operator's device is gone. The only things still in the
    //    world: the cloud blob, the peers' wallets, the peers'
    //    held envelopes. The operator's keypair is FORGOTTEN.

    // 5. New device generates a ceremony wallet, builds a request.
    const ceremony = Wallet.generate();
    const request = buildRecoveryRequestEnvelope(
      ceremony,
      operator.identity,
      'Alice',
      'I lost my phone, please verify by video and return your share',
    );
    expect(isRecoveryRequest(request)).toBe(true);
    const requestView = readRecoveryRequest(request);
    expect(requestView.oldIdentity).toBe(operator.identity);
    expect(requestView.newPubkey).toBe(ceremony.publicKey);
    expect(requestView.operatorName).toBe('Alice');

    // 6. Three of five peers respond (the other two are offline / out of touch).
    const respondingPeers = [peers[0]!, peers[2]!, peers[4]!];
    const responses = respondingPeers.map((peer) => {
      const held = heldByPeer.get(peer.publicKey);
      expect(held).toBeDefined();
      return buildShareResponseEnvelope(peer, held!, ceremony.publicKey);
    });
    for (const response of responses) {
      expect(isShareResponse(response)).toBe(true);
      const view = readShareResponse(response);
      expect(view.oldIdentity).toBe(operator.identity);
      expect(view.ceremonyPubkey).toBe(ceremony.publicKey);
      expect(view.threshold).toBe(M);
    }

    // 7. Ceremony device decrypts each response, combines M shares,
    //    decrypts the original blob.
    const recoveredShares = responses.map((r) => decryptShareResponse(ceremony, r));
    const reconstructedKData = combineShares(recoveredShares);
    expect(reconstructedKData).toEqual(kData);
    const decryptedBytes = decryptRecoverableWithKData(blob, reconstructedKData);
    const decryptedJson = new TextDecoder().decode(decryptedBytes);
    expect(decryptedJson).toBe(snapshotJson);
  });

  it('rejects a share-response addressed to a different ceremony', () => {
    const operator = Wallet.generate();
    const peer = Wallet.generate();
    const cohort: CohortMember[] = [
      { pubkey: peer.publicKey, name: 'P1' },
      { pubkey: Wallet.generate().publicKey, name: 'P2' },
    ];
    const kData = new Uint8Array(32).fill(0xab);
    const [pkg] = buildRecoveryShares(operator, kData, cohort, 2);
    expect(pkg).toBeDefined();

    const ceremonyA = Wallet.generate();
    const ceremonyB = Wallet.generate();
    const response = buildShareResponseEnvelope(peer, pkg!.envelope, ceremonyA.publicKey);
    // Ceremony B trying to decrypt a response addressed to ceremony A.
    expect(() => decryptShareResponse(ceremonyB, response)).toThrow(/different ceremony/);
  });
});
