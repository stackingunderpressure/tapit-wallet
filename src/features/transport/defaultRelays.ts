// The wallet ships with a default, replaceable relay set so it works
// out of the box, and a sovereign user can swap their own in (D-11a).
// These five are widely-used public Nostr relays; the exact set is
// not load-bearing — any subset that includes at least one reachable
// relay is enough for the wallet to function.
//
// Settings will surface this list as a user-editable preference in a
// later cut; today they are just the floor.
export const DEFAULT_RELAYS: readonly string[] = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://relay.primal.net',
  'wss://nostr.wine',
];
