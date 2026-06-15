import { describe, it, expect } from 'vitest';
import type { Attestation } from 'tapit-attest';
import { circleTrust, circleTrustWarning } from './circleTrust.ts';

const ME = 'a'.repeat(64);

// Minimal handshake attestation between ME and `peer` with a given tier.
function handshake(
  peer: string,
  verification: 'in-person' | 'remote',
  metInPerson = false,
): Attestation {
  const children: { node: 'leaf'; name: string; value: string }[] = [
    { node: 'leaf', name: 'verification', value: verification },
    { node: 'leaf', name: 'initiator_id', value: ME },
    { node: 'leaf', name: 'responder_id', value: peer },
  ];
  if (metInPerson)
    children.push({ node: 'leaf', name: 'met_in_person', value: 'true' });
  return {
    kind: 'relationship',
    subject: ME,
    issuedAt: '2026-01-01T00:00:00.000Z',
    claim: { node: 'branch', name: 'claim', children },
  } as unknown as Attestation;
}

const p = (n: number) => String(n).repeat(64).slice(0, 64);

describe('circleTrust', () => {
  it('is empty for no members', () => {
    expect(circleTrust([], []).verdict).toBe('empty');
  });

  it("verdict 'none' when no helper is verified in person", () => {
    const holdings = [handshake(p(1), 'remote'), handshake(p(2), 'remote')];
    const t = circleTrust([p(1), p(2)], holdings);
    expect(t.inPerson).toBe(0);
    expect(t.online).toBe(2);
    expect(t.verdict).toBe('none');
    expect(circleTrustWarning(t)?.tone).toBe('red');
  });

  it("self-attested counts separately, NOT as strong in-person", () => {
    const holdings = [handshake(p(1), 'remote', true), handshake(p(2), 'remote')];
    const t = circleTrust([p(1), p(2)], holdings);
    expect(t.selfAttested).toBe(1);
    expect(t.inPerson).toBe(0);
    expect(t.verdict).toBe('none'); // self-attested doesn't satisfy the strong gate
  });

  it("verdict 'thin' when some but fewer than recommended are in person", () => {
    // 4 members, recommended = ceil(4/3) = 2; only 1 in person.
    const holdings = [
      handshake(p(1), 'in-person'),
      handshake(p(2), 'remote'),
      handshake(p(3), 'remote'),
      handshake(p(4), 'remote'),
    ];
    const t = circleTrust([p(1), p(2), p(3), p(4)], holdings);
    expect(t.recommendedInPerson).toBe(2);
    expect(t.inPerson).toBe(1);
    expect(t.verdict).toBe('thin');
    expect(circleTrustWarning(t)?.tone).toBe('amber');
  });

  it("verdict 'ok' when enough are in person", () => {
    const holdings = [
      handshake(p(1), 'in-person'),
      handshake(p(2), 'in-person'),
      handshake(p(3), 'remote'),
    ];
    const t = circleTrust([p(1), p(2), p(3)], holdings);
    expect(t.inPerson).toBe(2);
    expect(t.verdict).toBe('ok');
    expect(circleTrustWarning(t)).toBeNull();
  });

  it('takes the strongest tier when a peer has multiple handshakes', () => {
    const holdings = [handshake(p(1), 'remote'), handshake(p(1), 'in-person')];
    const t = circleTrust([p(1)], holdings);
    expect(t.inPerson).toBe(1);
    expect(t.online).toBe(0);
  });
});
