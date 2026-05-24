import { useMemo } from 'react';
import type { Attestation } from 'tapit-attest';
import { isHandshake, readHandshake } from './createHandshake.ts';
import { extractPubkey } from './extractPubkey.ts';

// Peer picker — given the operator's holdings and their identity,
// surfaces the people they have already handshaken with as one-tap
// options AND a paste-a-public-key field. Both are always visible
// when there is at least one peer; the picker no longer hides the
// paste path behind a toggle link the operator may not see (which
// was actively invisible under the Fresh dark surface because the
// `text-accent` link rendered dark green on dark). The toggle
// pattern was the friction the operator named directly: "Won't
// let me paste new id code in only pick one peer I have." Show
// both, no clicks required.
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

  // Generous paste handling — if the user dropped an envelope JSON,
  // a hex with stray whitespace, or anything else extractPubkey
  // recognises, swap the field value for the clean hex immediately
  // so the form sees a valid pubkey without the user having to
  // hand-edit. Falls through to raw passthrough when extraction
  // yields nothing so partial typing still works.
  function handlePaste(raw: string) {
    const extracted = extractPubkey(raw);
    if (extracted) {
      onChange(extracted);
      return;
    }
    onChange(raw);
  }

  const valueNormalized = value.trim().toLowerCase();
  const valueValid = HEX_64.test(valueNormalized);
  const selectedPeer = peers.find((p) => p.pubkey === valueNormalized);

  return (
    <div className="space-y-3">
      {peers.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wide text-muted">
            From your connections
          </div>
          <ul className="mt-1.5 space-y-1">
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
        </div>
      )}

      <div>
        <div className="text-xs uppercase tracking-wide text-muted">
          {peers.length > 0 ? 'Or paste a public key' : 'Paste a public key'}
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => handlePaste(e.target.value)}
          placeholder="Paste their 64-char public key or full identity code"
          className="mt-1.5 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-xs font-mono"
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
        />
        {value.length > 0 && !selectedPeer && !valueValid && (
          <p className="mt-1 text-xs text-red-600">
            Doesn't look like a public key or identity code yet — keep
            typing or paste the full thing.
          </p>
        )}
        {selectedPeer && (
          <p className="mt-1 text-xs text-muted">
            Selected: <span className="font-medium">{selectedPeer.name}</span>
          </p>
        )}
      </div>
    </div>
  );
}
