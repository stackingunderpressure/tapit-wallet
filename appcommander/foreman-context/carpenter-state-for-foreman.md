# Carpenter state — for Foreman's eyes

**Operator-mode note:** AppCommander down. Operator running manual against live Netlify + Supabase deploy. Dual-surface comms active. v1 is shipped. Operator is on iOS.

**Branch state:** `claude/wallet-implementation-questions-umXHh`, six new commits on top of `c0d72be`. All pushed to origin. Branch is ahead of `origin/main` by six commits; operator merges from the cockpit when ready.

## WHAT-CHANGED-RECENTLY

This session executed the 2026-05-24 Fresh young-adult-friendly theme + IA roadmap brief in one aggregated push. Six of nine cuts landed as six clean commits, every gate green on each:

- `434147a` Cut 1: theme foundation. Tailwind fresh-* tokens via CSS variables, useTheme hook, prefs.theme field, Settings → Appearance toggle.
- `46b63dd` Cut 2: device-level theme + Fresh landing. localStorage mirror, synchronous bootstrap pre-render, FreshLoginShell, aurora-drift CSS.
- `a286dd3` Cut 3: Stories-style Today carousel. resolvedTheme threaded through WalletContext, FreshTodayCarousel with snap-x, FreshTodayCard with anchor edge-glow, JournalTabRouter dispatcher.
- `3b0d17c` Cut 4: floating compose FAB + Memories strip. useScrollDirection hook, FreshComposeFAB thumb-reach pair, FreshMemoriesStrip with per-day localStorage dismiss, findMemoryEntries pure helper.
- `747cf83` Cut 8: Crew avatar bubbles + connections extract. identicon.ts FNV-1a seeds, FreshCrew bubble row, ClassicConnections extracted from HomeScreen (dropped HomeScreen 796 → 773 lines).
- `c649d61` Cut 9: streak indicator + Memories/Streaks toggles. computeStreak math, FreshStreakIndicator chip, prefs.streaksEnabled + prefs.memoriesEnabled, Fresh extras toggle group in AppearanceSection.

Architectural pattern across all six cuts: every Fresh-specific component is a parallel file behind a theme gate, the Classic surface stays untouched, lazy-loaded so Classic operators never pay Fresh bytes. resolvedTheme is the single canonical Boolean read by every consumer; WalletProvider owns the apply-to-document effect.

## WHAT'S-PENDING

Three roadmap cuts deliberately deferred to dedicated sessions:

- **Cut 5 — onboarding rewrite (~400 lines).** Inverts the current auth flow: operator composes a first sentence or photo BEFORE sign-in, that text holds as volatile in-memory state, wallet generates keypair on passphrase commit, volatile entry gets signed and bound the moment email-code verification completes. Needs the next Carpenter to read `WalletProvider.tsx` phase-machine end-to-end first. The compose-before-sign-in state is the architectural crux; everything else (splash, name input, recovery primer card stack) is straightforward UI.
- **Cut 6 — Sage persona activation (~300 lines).** Depends on the persona framework wiring in `src/features/persona/` (currently dormant) and the bot brief which has not landed. Carpenter should not start Cut 6 until the bot brief specifies Sage's voice + register.
- **Cut 7 — share cards + Quick-share presets (~400 lines).** New `<ShareCard>` 9:16 component, preset catalog in Settings → Fresh, extends the existing `ShareProofModal`. Carpenter needs to read ShareProofModal end-to-end before touching this.

## WHAT-TO-FLAG

- **HomeScreen file-size pressure continues.** Currently 773 lines after Cut 8's extraction. Cut 5's onboarding work will likely push it again. The honest move before Cut 5 is a structural rethink — extract each tab into its own file, or move the modal-renders block into a routing helper. Anything Cut 5 adds is going to need room.
- **SettingsScreen also pressured.** Currently 745 lines. AppearanceSection grew through Cut 9; the budget bump (9KB → 10KB gzipped) bought time. Past 10KB the right move is to lazy-load AppearanceSection itself, especially since Cut 7's Quick-share preset catalog wants to live there too.
- **CSS budget at 6.42KB gzipped against the 7KB limit set in Cut 3.** Real headroom but not generous. Self-hosted font @font-face blocks would consume it quickly. If the operator wants licensed fonts (Geist, Recoleta, Berkeley Mono) the Carpenter needs both the font files and a budget re-think.
- **FreshCrew's connection cards still render in Classic palette.** Visual drift inside the otherwise-Fresh People tab. A FreshConnectionCard parallel file is a natural follow-on cut; I deferred it because the bubble strip was the headline feature.
- **Pre-auth Fresh surface only flips the LoginPage and the AuthGate-handled session-loading state.** The WalletGuide reachable at /about stays Classic under both themes. If the operator wants /about to also flip, that is another cut (would likely require adding the theme-aware tinting to WalletGuide's existing utility classes, or shipping a FreshWalletGuide parallel — non-trivial because WalletGuide is already 708 lines).
- **No tests were added for the new pure helpers** (computeStreak, findMemoryEntries, identiconSeed, resolveTheme, scrollDirection logic). All four are pure functions with stable contracts; honest test debt to flag. Would be a low-risk follow-on to add a `*.test.ts` per helper.

## RECOMMENDED-NEXT-MOVES

1. **Before Cut 5:** a structural-rethink session on HomeScreen. Extract each tab's body (Journal, Identity, People, Lattice, Captured) into its own component file. That work pays for itself by giving Cut 5 the room it needs for the onboarding state machine. Estimated 250 lines of pure refactor with no behaviour change.
2. **Cut 5 next** if structural rethink is done OR if the Carpenter is comfortable squeezing onboarding into the current HomeScreen footprint via lazy boundaries. Read WalletProvider phase machine first.
3. **Cut 7 before Cut 6** because the bot brief has not landed; share cards have no external dependency.
4. **Test debt sweep:** one short session to add tests for `computeStreak`, `findMemoryEntries`, `resolveTheme`, and `identiconSeed`. Pure helpers, stable contracts, low risk to lock in.

## OPERATOR'S-CURRENT-VIBE

Asked me to "cut as much of this as you possibly can without getting overloaded, when you get overloaded you can stop regroup re-ground and go some more until you don't wanna go no more." I read that as: ship aggressively, ground-and-extract when the file-size or architectural cost gets real, surface what's left honestly. I shipped six of nine, deferred three with clear reasons, and called the stopping point myself rather than pushing into Cut 5 half-grounded. The branch is clean, every commit is gated green, and the next Carpenter walks into accurate state.

## Ideas ready to revisit

- **FreshWalletGuide parallel surface** — the reference tabs reachable at /about currently stay Classic under Fresh. If the audience the brief targets wants to read Why/What/Recovery/Sovereignty under a Fresh register, this is a natural cut. Maturity: raw insight, surfaced 2026-05-24.
- **Lazy-load AppearanceSection** — when Cut 7's preset catalog lands and SettingsScreen pressure renews, lazy-loading the AppearanceSection itself is the cleanest move. Maturity: sprouting.
- **Self-hosted licensed fonts** — operator-mode question 1 from the brief. Once a decision lands, the work itself is small: woff2 files in public/fonts/, @font-face blocks in index.css, font-display: swap. Maturity: raw insight pending operator decision.
- **Anchor-confirmation shimmer animation** — Cut 9 mentioned but I did not ship. A FreshTodayCard could play the `fresh-shimmer` animation once when its anchor row transitions from verifying to confirmed. Small win, satisfying to see, no cryptographic concern. Maturity: sprouting.
