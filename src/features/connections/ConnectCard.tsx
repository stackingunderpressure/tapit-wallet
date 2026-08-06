import { InviteShareButton } from './InviteShareButton.tsx';

interface Props {
  founderPubkey: string;
  founderName: string;
  onNewHandshake: () => void;
  onScanEnvelope: () => void;
}

// The single "connect with someone" front door for the People tab.
// Operator feedback 2026-08-06: "these two menus need to be
// consolidated... I've got this code, I've got that code, your
// camera won't scan that... have it all on one page and explain
// what's going on well enough that any dummy could understand."
//
// Before this, the People tab had THREE separate entry points for what
// the operator experiences as ONE job — a standalone "Invite by link"
// card, a "+ New handshake" button, and a "Scan envelope" button — each
// with its own framing. This collapses them into one card with one
// clear primary action (scan or paste — HandshakeModal already leads
// with scan and falls back to paste per the 2026-06-15 Streamline CUT A
// work, which exists specifically because a home-screen PWA on iOS
// cannot reliably grant camera access, hence "your camera won't scan
// that"), one secondary action (share your own code), and the rarer
// generic-envelope scan tucked below as a small, clearly-labeled link
// rather than a competing top-level button.
//
// Written once in Classic-style tokens (ink/paper/white/accent), not
// theme-branched: index.css's `[data-theme="fresh"]` overrides already
// reskin these exact classes (bg-ink -> the Fresh lime CTA, bg-white ->
// the Fresh surface, text-accent -> the Fresh accent) for every other
// shared card in the app, and duplicating that here as a second,
// hand-styled Fresh copy would just be a second place for the two
// looks to drift apart.
export function ConnectCard({
  founderPubkey,
  founderName,
  onNewHandshake,
  onScanEnvelope,
}: Props) {
  return (
    <div className="mt-4 rounded-2xl border border-ink/10 bg-white p-4 shadow-sm">
      <div className="text-sm font-medium">Connect with someone</div>
      <p className="mt-1 text-xs text-muted">
        Scan a code, paste one they sent you, or share your own —
        whichever's easiest right now. All three do the same thing: you
        both end up holding a signed record that you're connected.
      </p>
      <button
        type="button"
        onClick={onNewHandshake}
        className="mt-3 w-full rounded-md bg-ink py-3 text-paper text-sm font-medium"
      >
        Scan or paste a code
      </button>
      <div className="mt-2">
        <InviteShareButton
          founderPubkey={founderPubkey}
          founderName={founderName}
          label="Share my code instead"
          variant="primary"
        />
      </div>
      <button
        type="button"
        onClick={onScanEnvelope}
        className="mt-3 text-xs font-medium text-accent hover:underline"
      >
        Got a different kind of code? (recovery, membership, etc.)
      </button>
    </div>
  );
}
