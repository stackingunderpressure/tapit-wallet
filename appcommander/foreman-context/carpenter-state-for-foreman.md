# carpenter-state-for-foreman — Fresh roadmap Cut 5 shipped

> PFOR-012 structured operational state. Written 2026-05-24 immediately after committing 46cb505. Replaces the prior session's state.

**Operator-mode note:** AppCommander down. Operator running manual against live Netlify + Supabase deploy. Dual-surface comms active. v1 is shipped. Operator is on iOS.

**Branch state:** `claude/wallet-implementation-questions-umXHh`, seven commits on top of `c0d72be`. All pushed to origin. Branch is ahead of `origin/main` by seven commits; operator merges from the cockpit when ready. Latest commit 46cb505.

## WHAT-CHANGED-RECENTLY

Fresh roadmap Cut 5 landed in commit 46cb505. The 90-second compose-before-login state machine the prior session deferred is now live. New feature folder src/features/onboarding/ holds pendingOnboarding.ts (module-level in-memory bundle, never persisted), applyOnboardingBundle.ts (post-sign-in identity + first entry creator), FreshOnboarding.tsx (the 6-step state machine: splash, compose, name, passphrase, recovery primer, email, code), and manifest.ts. WalletProvider gained an onboarding-setup phase that consumes the bundle and runs the post-sign-in ceremony under a Fresh-styled "Signing your first entry..." overlay. LoginPage now lazy-loads FreshLoginShell so the cold-start login bundle Classic operators land on dropped from 14.15KB gzipped to 11.09KB. FreshLoginShell's signed-out branch now delegates to FreshOnboarding; the obsolete inline FreshSignInLanding was removed. Bundle budgets: login bundle 11.09KB under 12KB, WalletProvider 7.75KB under bumped 8KB, new FreshLoginShell lazy chunk 4.19KB under 5.5KB. All four gates green; one file-size warning on FreshOnboarding.tsx at 751 lines under the 800-line hard limit.

## WHAT'S-PENDING

Two cuts remain from the 2026-05-24 Fresh young-adult-friendly theme + IA roadmap. Cut 6 is the Sage persona activation that wires the dormant src/features/persona scaffolding as a context-aware nudge layer surfacing recovery-key and cohort-setup suggestions; depends on the persona framework and on a Sage voice the operator should author rather than the carpenter inventing it from training data. Cut 7 is the share cards plus Quick-share selective-disclosure presets — the 9-by-16 share-card render component, the preset catalog under Settings, and extending ShareProofModal to optionally render via the new share card. Both cuts can land independently in any order the operator prefers. The carpenter-opinions.md flagged a small ergonomic question about the returning-operator-on-fresh-device edge case where the captured compose bundle is silently discarded; that is a known acceptable trade-off the operator should be aware of but not blocking.

## WHAT-TO-FLAG

The compose step deliberately allows the operator to continue with both text and attachment empty so the wallet still gets set up if the operator wants to skip the compose moment; the copy reads "You can leave both empty — your wallet will still get set up." This is honest but the operator may want warmer copy or a stronger nudge to actually compose, since the brief framed compose as the moment of magic. The applyOnboardingBundle helper passes a null anchor worker to createJournalEntry because the worker has not started yet at bundle-apply time; the entry's anchor takes one poll cycle longer than a routine entry would (seconds, not minutes — negligible operator-visible difference). The FreshOnboarding.tsx file is 751 lines, comfortably under the 800-line hard limit but past the 400-line warn threshold; intentional choice to keep the linear flow in one file. If the operator wants the extracted shape into a steps/ subfolder, the extraction is mechanical because every step component is already a pure function of its props. The recovery primer copy is carpenter-authored placeholder; the operator may want to author the actual voice once Sage's persona lands in Cut 6.

## RECOMMENDED-NEXT-MOVES

The operator should browser-verify the Cut 5 onboarding on the Netlify deploy first: pick Fresh in Settings → Appearance on an existing wallet so the device-level theme persists, sign out, hit /login, walk the 90-second flow from splash through OTP, confirm the home screen lands with the founding identity attestation and the first journal entry already present and queued for OpenTimestamps anchoring. If that golden path holds, the next dispatch should pick between Cut 6 (Sage activation — operator needs to provide the voice and the tone) or Cut 7 (share cards + Quick-share presets — design-heavier, less voice-dependent). My read is Cut 7 lands more independent value sooner because the share cards become the audience's distribution channel; Cut 6 needs the operator to author Sage's actual personality and that's a meaningful authorship investment.

## OPERATOR'S-CURRENT-VIBE

The operator authorized Cut 5 with a single "Go" after the grounding report. They listen to chat replies via TTS — the one-block prose format matters. They wanted the prior session's six-cuts-in-one push, paused before the structural cut, and are now taking the deferred ones as dedicated sessions per the prior carpenter's feedback. The wallet is in pre-pilot polish phase; cuts 5, 6, 7 are the last surfaces before the Fresh young-adult-friendly skin is ready for the audience the brief targets. The operator is shipping a real consumer product on a real cryptographic substrate; clarity beats cleverness, the keys-never-leave rule outranks every other rule, and the compose-first inversion shipped in this cut is structurally arguing that the operator's life is the substrate and the wallet is the witness.

## Ideas ready to revisit

No new ideas surfaced in this session beyond execution of Cut 5; the brief itself was already in the registry. No prior unengaged ideas surface as fitting the current question; the next dispatch is structural (Cut 6 or Cut 7) and the relevant doctrine is already in the brief.
