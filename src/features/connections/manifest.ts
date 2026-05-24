import type { FeatureManifest } from '../../shared/lib/manifest.ts';

export const manifest: FeatureManifest = {
  slug: 'connections',
  born: '2026-05-22',
  purpose:
    'Phases 5a, 5b, and 5c-ii of the Mycelium peer network (MYCELIUM_NETWORK_SPEC.md). 5a — the in-person handshake (Tier P): two wallets physically together exchange identities by QR and co-sign one relationship attestation carrying verification=in-person; both hold it. 5b — organizations and membership: an organization is itself a wallet, and a membership is a credential the organization signs about a person; memberships nest. 5c-ii — the remote handshake (Tier R, per D-09): two wallets that have never been in the same room form the same relationship attestation but with verification=remote, sent via Nostr; the initiator builds + signs + ships, the responder cosigns via the existing inbox routing, both hold the dual-signed Tier R record. ConnectionCard renders the badge by tier — accent for Tier P, neutral for Tier R — so a verifier always sees which kind of link it is.',
  touches: [
    'src/features/connections/HandshakeModal.tsx',
    'src/features/connections/MembershipModal.tsx',
    'src/features/connections/createHandshake.ts',
    'src/features/connections/createMembership.ts',
    'src/features/connections/createOrganization.ts',
    'src/features/connections/OfficialsEditorModal.tsx',
    'src/features/connections/RatificationsBadge.tsx',
    'src/features/connections/MembershipChainSheet.tsx',
    'src/features/connections/ConnectionCard.tsx',
    'src/features/connections/MembershipCard.tsx',
    'src/features/connections/PeerPicker.tsx',
    'src/features/connections/ClassicConnections.tsx',
    'src/features/connections/FreshCrew.tsx',
    'src/features/connections/identicon.ts',
  ],
  depends_on: ['wallet-core', 'qr', 'cosigning', 'anchoring', 'theme'],
  pause_safe: true,
  removal_safe: false,
  monetizable: false,
  notes:
    'A handshake is a relationship-kind attestation; a membership is a credential-kind attestation — no new tapit-attest kinds. The modals reuse QrShow / QrScanModal and the cosigning parseEnvelope + mergeSignatures helpers. wallet-core/HomeScreen.tsx imports both modals and both cards, so removal_safe is false. The handshake is co-signed (3 QR transmissions for Tier P); a membership is one-directional (2 QR transmissions — only the issuing organization signs). Tier R remote handshakes (5c-ii) reuse the same envelope shape with verification=remote and travel through the Mycelium transport; the responder side reuses 5c-i-ε auto-routing (1-sig → cosign-witness; 2-sig → absorb). 5b-org-i adds createOrganization — a self-signed credential-kind attestation lets a wallet declare itself an organization; Home flips to org-mode rendering on the Identity tab; Settings exposes the declaration form (one-way for now). 5b-org-ii adds the officials roster — a second self-signed credential names the organization current officers, with publishOfficialsRoster snapping a new full roster envelope on every edit (history preserved; latest by issued_at wins). OfficialsEditorModal handles add / remove inline; readOfficials + findLatestOfficialsRoster are reusable by future cuts (ratifications view, verifier flows). 5b-org-iii ships countRatifications + RatificationsBadge — the badge renders N of M ratifications when the viewer has access to the org roster (org-side always; member-side only if the operator holds a copy of the org roster). Tone scales by progress (neutral / amber / emerald). Member-side rendering silently omits the badge when no roster is available so the card stays honest about what can be locally verified. 5b-org-iv ships walkOrgChain + MembershipChainSheet — tapping a MembershipCard walks the nesting chain upward through local holdings (you are a member of X; X is a member of Y; Y of Z) and renders the stack. When the walker runs out of locally-held data it labels the chain truncated so the operator stays honest about visibility. Read-only; reusable from any context that wants to walk the structure.',
};
