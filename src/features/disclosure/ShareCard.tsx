// The 9:16 share-card visual treatment. Cut 7 of the 2026-05-24
// Fresh young-adult-friendly theme + IA roadmap. Designed for the
// audience's actual distribution channel — the screenshot. Top
// carries the assertion, middle carries the supporting evidence
// (an envelope-kind label + the disclosed-field summary), bottom
// carries the OpenTimestamps Bitcoin-block stamp, the wallet
// wordmark, and the verifier URL.
//
// Pure presentation. The card has no business logic — it accepts
// the assertion text, the evidence text, the optional anchor
// block height, and the verifier URL as props, and renders. The
// caller is responsible for minting the proof bundle and
// computing the verifier URL.

interface Props {
  /** Top line. Plain English ("I have a verified profile", "I'm a
   *  member of West Side Climbing"). One line, big. */
  assertion: string;
  /** Sub-line under the assertion, smaller. Describes what is
   *  actually being attested. */
  evidence: string;
  /** Bitcoin block height the proof's envelope anchored to. Omit
   *  when the entry has not yet anchored — the bottom row shows
   *  "Anchoring to Bitcoin…" instead. */
  btcHeight?: number;
  /** Plain-English ISO timestamp of when the envelope was signed.
   *  Rendered as a "Signed Mar 14, 2026" line so a verifier
   *  reading the screenshot sees the date without parsing
   *  the underlying envelope. */
  issuedAt: string;
  /** URL the verifier taps to validate the proof. Either /verify
   *  (verifier pastes the bundle) or /verify?p=<base64url> for the
   *  one-tap path. */
  verifyUrl: string;
}

function formatIssued(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function ShareCard(props: Props) {
  return (
    // The aspect-[9/16] wrapper carries the screenshot-target shape.
    // max-w-[360px] keeps it bounded on tablets; on phone-width it
    // fills the available column. The inner padding leaves a comfortable
    // margin for the screenshotter to crop without losing edges.
    <div className="mx-auto w-full max-w-[360px] aspect-[9/16] overflow-hidden rounded-3xl border border-fresh-surface-edge bg-fresh-surface-raised shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]">
      <div className="relative h-full w-full fresh-aurora-bg">
        <div className="relative flex h-full flex-col px-6 pt-7 pb-6 text-fresh-text-primary">
          {/* Wordmark — small and quiet so the assertion owns the
              visual gravity. */}
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full bg-fresh-accent-primary shadow-[0_0_12px_rgba(192,252,77,0.7)]"
            />
            <span className="text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-fresh-text-primary">
              Tapit Wallet
            </span>
          </div>

          {/* Top — the assertion. The big claim the screenshot is
              about. Wraps onto multiple lines as the assertion gets
              long; the tight tracking keeps it editorial. */}
          <div className="mt-10">
            <p className="text-[0.62rem] uppercase tracking-[0.18em] text-fresh-accent-primary">
              Verified by math
            </p>
            <h2 className="mt-2 text-[2.1rem] font-fresh-display leading-[1.05] tracking-[-0.03em]">
              {props.assertion}
            </h2>
            <p className="mt-3 text-sm text-fresh-text-secondary">
              {props.evidence}
            </p>
          </div>

          {/* A spacer that pushes the bottom block to the bottom edge
              while the assertion stays anchored to the top third — the
              compositional logic the audience already reads as Stories
              language. */}
          <div className="flex-1" />

          {/* Bottom — Bitcoin block stamp + signed-on date + verify URL.
              The amber glow on the block height is the visual signal that
              this is anchored to a public clock the wallet did not invent. */}
          <div className="mt-6 rounded-2xl border border-fresh-surface-edge bg-fresh-surface-glass px-4 py-3 backdrop-blur-xl">
            {typeof props.btcHeight === 'number' ? (
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 rounded-full bg-fresh-anchor-glow shadow-[0_0_10px_rgba(245,158,11,0.7)]"
                />
                <p className="text-xs text-fresh-text-secondary">
                  Bitcoin block{' '}
                  <span className="font-fresh-mono font-medium text-fresh-text-primary">
                    {props.btcHeight.toLocaleString()}
                  </span>{' '}
                  · verified
                </p>
              </div>
            ) : (
              <p className="text-xs text-fresh-text-tertiary">
                Anchoring to Bitcoin…
              </p>
            )}
            <p className="mt-1 text-xs text-fresh-text-tertiary">
              Signed {formatIssued(props.issuedAt)}
            </p>
            <p className="mt-2 break-all text-[0.66rem] text-fresh-accent-secondary">
              {props.verifyUrl}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
