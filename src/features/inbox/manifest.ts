import type { FeatureManifest } from '../../shared/lib/manifest.ts';

export const manifest: FeatureManifest = {
  slug: 'inbox',
  born: '2026-08-10',
  purpose:
    "One screen aggregating everything that has ever arrived at this wallet over Nostr -- chat messages, spend requests, vault-membership invites, family/circle attestation arrivals, and safety phrases -- with category tabs, per the operator's 2026-08-10 request: \"we need an inbox ... I feel like we need one spot where all of that is.\" Every category already had a receiving surface scattered elsewhere in the app (a chat list buried in the People tab, spend-request and vault-invite banners at the top of Home, safety phrases only visible in Settings); this feature does not re-implement any of that receive/accept/decline logic, it composes the existing self-contained hooks and components into one place reachable from a header link.",
  touches: ['src/features/inbox/InboxScreen.tsx'],
  depends_on: ['wallet-core', 'transport', 'sign-request', 'circle-phrase', 'connections'],
  pause_safe: true,
  removal_safe: true,
  monetizable: false,
  notes:
    "InboxScreen.tsx is read-only aggregation, not a new data path: it calls useWallet() for inboxEnvelopes/chatThreadsByPeer (already-global state owned by WalletProvider, no new subscription), mounts its own useInboxRouting() instance (same hook HomeScreen uses, independently instantiated -- each screen owns its own modal stack), and renders the EXISTING IncomingPsbtCosignBanner, IncomingVaultMembershipBanner, InboxPanel, and CirclePhraseSection components as-is inside category sections. usePsbtCosignRequests/useVaultMembershipRequests/listCirclePhrasePairs are also called directly here (in addition to the banners' own internal calls to two of the same hooks) purely so an empty category can say 'Nothing waiting' instead of showing a bare header with nothing under it -- this is a second, independent subscription for the same Nostr filter, not a shared one, matching the existing pattern of every screen owning its own subscriptions rather than threading them through props. The 'Messages' tab lists chatThreadsByPeer (global chat state) sorted by last-message time and links to '/?tab=people', which HomeScreen.tsx's new initialTabFromUrl() reads once on mount to land directly on the People tab where the full thread lives -- deep-linking into a SPECIFIC peer's open thread was deliberately left alone (that selection state is owned locally inside PeopleTabBody and lifting it to the URL is a bigger, separate change not needed to satisfy 'one spot to see it's there and click through').",
};
