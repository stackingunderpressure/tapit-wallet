import { useMemo, useState } from 'react';
import type { Attestation } from 'tapit-attest';
import { isHandshake, readHandshake } from './createHandshake.ts';

// Peer picker — given the operator's holdings and their identity,
// surfaces the people they have already handshaken with as one-tap
// options. A manual-paste fallback covers the case where the
// operator wants to send to someone not yet in their People tab.
// Used by any modal whose Send-via-Nostr step needs a recipient
// pubkey.
//
// The peer's pubkey is recovered from the handshake's signed leaves
// (initiator_id / responder_id), so this works for both the
// initiator and the responder side of a Tier P handshake.

export interface PeerOption {
  pubkey: string;
  name: string;
}

interface Props {
  holdings: readonly Attestation[];
  myIdentity: string;
  /** The currently-selected pubkey (controlled). */
  value: string;
  onChange: (pubkey: string) => void;
}

const HEX_64 = /^[0-9a-f]{64}$/i;

function peerFromHandshake(
  att: Attestation,
  myIdentity: string,
): PeerOption | null {
  const v = readHandshake(att);
  if (v.initiatorId === myIdentity) {
    if (!v.responderId) return null;
    return { pubkey: v.responderId, name: v.responderName || 'Unknown' };
  }
  if (v.responderId === myIdentity) {
    if (!v.initiatorId) return null;
    return { pubkey: v.initiatorId, name: v.initiatorName || 'Unknown' };
  }
  return null;
}

function uniqueByPubkey(peers: PeerOption[]): PeerOption[] {
  const seen = new Set<string>();
  const out: PeerOption[] = [];
  for (const p of peers) {
    if (seen.has(p.pubkey)) continue;
    seen.add(p.pubkey);
    out.push(p);
  }
  return out;
}

function shortKey(hex: string): string {
  if (hex.length <= 12) return hex;
  return `${hex.slice(0, 8)}…${hex.slice(-4)}`;
}

export function PeerPicker({ holdings, myIdentity, value, onChange }: Props) {
  const peers = useMemo(() => {
    const found: PeerOption[] = [];
    for (const a of holdings) {
      if (!isHandshake(a)) continue;
      const p = peerFromHandshake(a, myIdentity);
      if (p) found.push(p);
    }
    return uniqueByPubkey(found);
  }, [holdings, myIdentity]);

  const [showPaste, setShowPaste] = useState(peers.length === 0);
  const valueNormalized = value.trim().toLowerCase();
  const valueValid = HEX_64.test(valueNormalized);
  const selectedPeer = peers.find((p) => p.pubkey === valueNormalized);

  return (
    <div>
      {peers.length > 0 && !showPaste && (
        <>
          <div className="text-xs text-muted">From your connections:</div>
          <ul className="mt-1 space-y-1">
            {peers.map((p) => (
              <li key={p.pubkey}>
                <button
                  type="button"
                  onClick={() => onChange(p.pubkey)}
                  aria-pressed={selectedPeer?.pubkey === p.pubkey}
                  className={`w-full text-left rounded-md px-3 py-2 text-sm border ${
                    selectedPeer?.pubkey === p.pubkey
                      ? 'bg-accent/10 border-accent text-ink'
                      : 'bg-white border-ink/15 hover:bg-ink/5'
                  }`}
                >
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted">{shortKey(p.pubkey)}</div>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setShowPaste(true)}
            className="mt-2 text-xs text-accent hover:underline"
          >
            Or paste a public key…
          </button>
        </>
      )}

      {showPaste && (
        <>
          {peers.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setShowPaste(false);
                onChange('');
              }}
              className="mb-2 text-xs text-accent hover:underline"
            >
              ← Pick from your connections
            </button>
          )}
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="64-character hex public key"
            className="w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-xs font-mono"
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
          />
          {value.length > 0 && !valueValid && (
            <p className="mt-1 text-xs text-red-600">
              Needs 64 hex characters.
            </p>
          )}
        </>
      )}
    </div>
  );
}
