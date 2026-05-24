# Fresh — young-adult-friendly theme + IA roadmap (2026-05-24)

> Status: SKETCH. Brief for the parallel "Fresh" presentation
> layer that ships alongside the existing "Classic" surface.
> Same cryptographic core, same envelope kinds, same recovery
> story — new visual language, new information architecture,
> new onboarding, the dormant `persona` bot activated as the
> friendly guide. Operator-authored direction: "make a younger
> audience fall in love with it. Match current color trends
> and styles. Don't go lazy."
>
> Companion to `DESIGN.md`, `MYCELIUM_NETWORK_SPEC.md`,
> `WalletGuide.tsx`. References to Tailwind tokens map to
> `tailwind.config.ts` extensions; references to existing
> animations live in the same file.

## What this is and is not

**Is.** A parallel theme + IA + onboarding skin that operators
opt into in Settings → Appearance. Same `tapit-attest` core,
same envelope kinds, same recovery story, same routes. The
classic surface stays as default until adoption signal warrants
flipping it. Both surfaces share every cryptographic primitive,
every feature flag, every gate test. A user can switch back and
forth without re-onboarding.

**Is not.** A fork. A rewrite. A separate wallet. A
gamification of identity. A compromise on math-not-trust. A
"crypto-bro" reskin — the audience the brief targets is young
adults who DO NOT identify with crypto culture but DO identify
with "the platforms own too much of me" and "I want to remember
my own life on my own terms."

## The audience and what they actually want

Target: 18-30, post-platform-trust by lived experience (already
got deplatformed once, already lost an Instagram account,
already had to prove a credential to a service that demanded
their birthday for an age check). They do not pre-identify as
"sovereign users" — they pre-identify as artists, students,
people-with-anxiety, gym-goers, club-goers, organizers, makers,
caregivers. The wallet's job is to land in their hand as
"finally an app that holds my actual life without asking who
I am first."

The actual jobs-to-be-done that fit this audience natively:

- **Prove I'm 21+ at the door without showing my date of birth.**
  Selective disclosure of one identity leaf already exists;
  packaging it as "tap to share I'm over 21" is the
  surface gap.
- **Document this moment cryptographically so I can prove it
  was real later.** Journal entry plus attachment plus Bitcoin
  anchor already exists; the framing right now reads as
  "diary," the framing this audience needs is "receipts for
  your life."
- **Get my wallet back when I lose my phone via the friends
  I already trust.** Cohort cascade already exists; the
  social-graph framing maps to "close friends" lists they
  already curate.
- **Hold my gym membership / concert tickets / club
  affiliations as math, not someone else's database row.**
  Memberships already exist (Phase 5b); the surface needs to
  feel like a wallet of cards not a list of credentials.
- **Have a private journal that nobody — including the app —
  can read except me, where my creative ideas get timestamped
  the moment I write them.** All shipped; needs surfacing.

## Visual identity — Fresh tokens

The Classic palette stays. Fresh adds a parallel token set
that Tailwind exposes via CSS variables so a single
`<html data-theme="fresh">` switch flips everything at once.
The Fresh tokens deliberately match late-2025 / 2026 trends —
Liquid Glass depth, deep-neutral backdrops with bold electric
accents, expressive type, motion-first.

### Colors

```ts
// tailwind.config.ts theme.extend.colors additions, gated
// behind the data-theme="fresh" selector via CSS variables.

// Surface — deep neutral with material depth
'fresh-surface-base':    '#0b0c0f',  // near-black ink
'fresh-surface-raised':  '#15171c',  // card depth
'fresh-surface-glass':   'rgba(255, 255, 255, 0.06)', // frosted layer
'fresh-surface-edge':    'rgba(255, 255, 255, 0.08)', // hairline border

// Text — high contrast on deep
'fresh-text-primary':    '#f4f4f5',  // titanium white
'fresh-text-secondary':  '#a1a1aa',  // ash
'fresh-text-tertiary':   '#71717a',  // graphite
'fresh-text-inverse':    '#0b0c0f',  // for on-accent

// Accent — electric, decisive, not corporate
'fresh-accent-primary':  '#c0fc4d',  // electric lime — the brand pop
'fresh-accent-secondary':'#a78bfa',  // digital lavender — the supporting role
'fresh-accent-warning':  '#fbbf24',  // honey amber — soft warnings
'fresh-accent-danger':   '#f87171',  // coral — destructive

// Semantic — anchored-to-Bitcoin gets its own treatment
'fresh-anchor-glow':     '#f59e0b',  // amber-with-radial-glow, used for
                                     // Bitcoin-anchored elements
'fresh-mycelium-glow':   '#22d3ee',  // cyan, used for live network indicators

// Backgrounds with motion
// Use radial-gradient + animated noise for the landing surface
// instead of the Classic float-glows. See Motion section below.
```

Light Fresh is a follow-on; dark Fresh ships first because the
audience expects dark-default and the deep neutral does most of
the visual work.

### Typography

```ts
// fontFamily extensions

'fresh-display': [
  'Editorial New', // when licensed; primary display
  'Recoleta',      // licensed fallback
  'ui-serif',
  'Georgia',
  'serif',
],
'fresh-body': [
  'Geist',         // primary; clean modern sans w/ character
  'Inter',         // ubiquitous fallback
  'system-ui',
  '-apple-system',
  'sans-serif',
],
'fresh-mono': [
  'Berkeley Mono', // when licensed
  'JetBrains Mono',
  'IBM Plex Mono',
  'ui-monospace',
  'monospace',
],
```

Headline scale shifts. Classic uses font-serif at modest sizes
for a quietly-considered register. Fresh uses fresh-display at
larger sizes with tighter tracking for editorial weight:

- `text-fresh-hero`: 48px / 1.05 / -0.04em
- `text-fresh-display`: 32px / 1.1 / -0.03em
- `text-fresh-title`: 22px / 1.2 / -0.02em
- Body and helper text inherit the global 14/15px floor from
  the iPhone readability rule (already shipped).

### Materials — Liquid Glass

Three layer materials available throughout Fresh:

1. **Glass** — `bg-fresh-surface-glass` + `backdrop-blur-xl` +
   `border border-fresh-surface-edge` + `shadow-2xl
   shadow-black/40`. Used for cards over the textured backdrop.
2. **Raised** — `bg-fresh-surface-raised` + subtle inner-stroke
   for ink-on-near-black contrast. Used for the highest-
   information-density surfaces (lists, settings rows).
3. **Frosted overlay** — modal scrims use `bg-black/60` +
   `backdrop-blur-md` so the page behind diffuses through.

The Liquid-Glass aesthetic from iOS 26 leans into translucent
depth that responds to motion. Where iOS uses live magnification
on tap, Fresh uses subtle parallax: cards translate-y by 1-2px
on press and the glass border glows briefly with
`fresh-accent-primary` at 20% opacity.

### Motion

```ts
// keyframes + animation extensions

'fresh-rise': '...',           // existing rise, spring-tuned
'fresh-press': '...',          // tap feedback, 0.92 scale + glow
'fresh-shimmer': '...',        // anchored-confirmation reveal
'fresh-stamp': '...',          // share-card OTS block-N reveal
'fresh-aurora': '...',         // landing background, slow gradient drift
```

Spring physics over linear easing. Page transitions use the
View Transitions API where available (Safari 18+, Chrome 111+,
PWA-eligible) with a graceful fallback to fade. Scroll-driven
animations on the Stories carousel (one card per viewport,
snap-x, scroll-margin tuned).

Motion-reduced respect remains absolute — every animated
surface honors `prefers-reduced-motion: reduce` and falls back
to instant or fade-only equivalents. Non-negotiable.

## Information architecture — Fresh

### Tab rename + reorder

Classic | Fresh
-----|-----
Journal | Today
Identity | You
People | Crew
Lattice | Web
Captured | Caught

The renames lower the register without changing the underlying
features. "Today" anchors the journal as a daily practice, not
an archive. "Crew" maps to how this audience already labels
their close friends. "Caught" mirrors how they describe
content they want to remember from elsewhere ("good catch").

### Stories-style horizontal carousel for Today

The existing journal-category tabs become a horizontal
swipeable carousel. Each category gets a card surface that
swipes left/right with snap-points. The currently-active
category fills the viewport; adjacent categories peek 12-16px
into view as affordance. Anchored entries get a small amber
glow on their card edge; un-anchored entries pulse cyan during
their first hour as "still timestamping."

### Floating thumb-target compose

Replace the existing top-bar `+ New entry` link with a
thumb-reachable floating action button in the bottom-right that
opens the composer. Position 24px from bottom-right, 56x56px,
`bg-fresh-accent-primary` with a subtle inner glow on press.
Disappears on scroll-down, reappears on scroll-up (already a
known pattern from Twitter / Threads).

### Memories surface

A new top-of-Today section that surfaces Bitcoin-block
anniversaries: "1 year ago today, you signed this. Block
873,142 confirms it existed by then." The math is already in
place (every entry has an anchor block height; comparing today
against entries from 365 / 30 / 7 days ago is one filter).
Visual treatment: a horizontal strip above the journal
carousel, dismissable per-day so it doesn't nag, optional
toggle in Settings → Appearance → Memories.

### Crew avatars

Replace the People-tab list with a top-row of circular avatar
bubbles (32-40px) for each handshake-connected peer, sorted by
recency-of-interaction. Tapping an avatar opens the per-peer
detail — every envelope you've co-signed, every membership
you share, every share-share-of-the-cohort relationship.
Below the bubbles: the existing connection cards in a denser
grid layout.

### Streaks

Daily-entry streaks surfaced as a small persistent indicator
("🔥 12 day streak") in the Today tab header. Streak is a
client-side derivation from the operator's journal entries
filtered by signed-at-date. No new cryptography. Resetting on
zero-entry days is the natural cost-of-laziness signal but
Settings should allow turning streaks off (some operators
will read them as guilt-inducing — honest opt-out).

## Onboarding rewrite — 90 seconds to first signed entry

Classic onboarding: login → wait for email code → type code →
land on passphrase prompt → choose passphrase → IdentityCeremony
asks for display name → HomeScreen empty state. Maybe 3-4
minutes if email is slow.

Fresh onboarding skips the marketing essay and shortens every
step:

1. **Splash** (3s): the wordmark dissolves into a single line —
   "What just happened to you?" — over the aurora-drift background.
2. **Compose first** (30s): the operator types a sentence about
   their day OR snaps a photo. No login, no passphrase yet. The
   text/photo lives in volatile in-memory state. The screen
   shows the entry with a faded "this isn't signed yet — let's
   make it real" subtitle.
3. **Choose a name** (10s): "what should this record show as the
   name on it?" Simple text input. Becomes the display name on
   the identity attestation.
4. **Choose a passphrase** (15s): "this is the only secret only
   you know. Forgetting it makes the record harder to recover —
   we'll show you a recovery key and a friend-cohort path on the
   next screen." Two-field with confirm; iOS-zoom-prevented per
   the existing CSS.
5. **Recovery primer** (20s): a 3-card tutorial — paper recovery
   key + friend cohort + encrypted file backup — with a single
   acknowledge button. Doesn't make them DO it now; just plants
   the awareness.
6. **Login association** (10s): "to keep your wallet across
   devices, we'll associate it with an email." Email input,
   6-digit code arrives. The wallet they composed in step 2 is
   now signed under their new key and bound to their session.

Total operator-perceived time: 90 seconds (most of it is the
6-digit-code wait, which is parallelized with the recovery
primer). The first signed entry lives in the wallet by the
time login completes. That's the moment of magic.

### Bot activation as guide

The dormant `persona` framework under `src/features/persona/`
gets its first real shape as "Sage" — a name and a voice
specifically tuned for Fresh. Sage runs as a small overlay
during onboarding (steps 2-5 above) and surfaces context-
aware nudges in the wallet ("hey, you haven't set up a
recovery key yet — want to walk through it now?"). Tone is
warm, casual, never preachy. Uses the existing PersonaProfile
shape from `src/features/persona/types.ts`. The Anthropic API
key already declared in CLAUDE.md gates the live-LLM half;
the deterministic-nudges half ships first and the live-chat
half follows when the bot brief lands.

## Feature additions

### Quick selective-disclosure presets

Settings → Fresh → "Quick share" exposes one-tap presets that
generate selective-disclosure proofs:

- "I'm over 18" — discloses the boolean derived from the
  birthday leaf, not the date itself.
- "I'm over 21" — same.
- "I belong to {organization}" — for each org membership.
- "I have a verified profile" — discloses just the identity
  attestation existence.

Each preset opens an existing ShareProofModal pre-configured
with the right leaves. The output is a share card (see below)
designed for screenshotting and sending through whatever channel
makes sense — DM, AirDrop, holding the phone up at a door.

### Share cards

A new visual treatment for selective-disclosure proofs and
journal-entry permalinks: a 9:16 aspect-ratio card optimized
for screenshot-and-share. Top: the assertion ("Over 21",
"Marathon finisher 2025", "verified the prescription matches").
Middle: the visual evidence or attestation type. Bottom: the
OpenTimestamps block stamp ("Bitcoin block 873,142, verified"),
the wallet wordmark, a short URL for the third-party
verification (already exists at `/verify`).

The audience treats screenshots as the universal sharing
substrate. The wallet should produce screenshots that LOOK
designed-for-screenshotting.

### Crew snapshots

"Crew snapshot" generates a card showing your current cohort
(blurred names, identicons), threshold, and "your recovery is
real, here are the people protecting it." Useful for showing
a friend you've added them to your cohort. Doesn't reveal
anything they don't already know.

## Theme architecture

A single Settings → Appearance toggle: Classic / Fresh /
System. Classic is today's surface unchanged. Fresh is the
new theme. System inherits the OS preference but defaults to
Fresh on first-run for new wallets created after the toggle
ships (existing wallets stay Classic until they explicitly
flip).

Implementation pattern: every theme token lives as a CSS
variable scoped to `[data-theme="fresh"]`. The Tailwind
config exposes those variables as utility classes
(`bg-fresh-surface-glass`, etc.) so existing components can
opt into the Fresh palette per-prop without parallel files.
Components that fundamentally render differently in Fresh
(the Stories carousel, the floating compose button, the
Memories strip) ship as new files alongside the Classic ones
and conditionally render based on the active theme.

A `useTheme()` hook reads from `prefs.theme` (new pref).
The wallet store schema bumps so this writes locally; cloud
mirror picks it up via the existing v2 blob path. Theme
toggling is instant, no reload.

## Phasing — Carpenter-ready cut sequence

Each cut is bounded, testable, and ships value alone. Estimated
sizes are conservative. Skip a cut if it doesn't earn its way.

### Cut 1 — Tokens + theme infrastructure (~150 lines)

Tailwind config extension with the Fresh color + type +
animation tokens. New `useTheme()` hook. `prefs.theme` field
added to `prefsStore` (schema bump, default 'classic'). New
Settings → Appearance section with the toggle. `<html
data-theme>` attribute set on theme change. No other
visual changes — just the foundation.

### Cut 2 — Fresh shell + landing surface (~250 lines)

Fresh background (aurora-drift gradient + subtle noise),
Fresh LoginPage variant rendered when theme=fresh, Fresh
typography classes loaded via font CDN or local @font-face,
Fresh wordmark variant, motion-reduced fallbacks. WalletGuide
gets a Fresh styling variant. From this cut on, an operator
who flips the toggle sees a visually-distinct wallet, even
though the IA hasn't changed yet.

### Cut 3 — Stories-style Today tab (~300 lines)

`<FreshTodayCarousel>` component replacing JournalTabs +
JournalCard when theme=fresh. Horizontal snap-x scroll, peek
affordance, per-category card surface, anchor-status glows.
Existing Classic surface untouched.

### Cut 4 — Floating compose + Memories strip (~200 lines)

The thumb-reach FAB for composing, conditional on Fresh. The
Memories strip above Today, sourcing from
`journal-entries-365-30-7-days-ago` filter. Per-day dismiss.
Settings toggle.

### Cut 5 — Onboarding rewrite (~400 lines)

The 90-second flow as a new `<FreshOnboarding>` component.
Compose-before-login state machine (volatile in-memory entry
held until session bind). Conditional render in `AuthGate` /
`WalletProvider`. Classic onboarding stays for theme=classic.

### Cut 6 — Sage activation + nudges (~300 lines)

Activate the persona framework. Sage profile + a small
context-aware nudge surface that watches `holdings` and
`prefs` and surfaces an unobtrusive suggestion when the
operator is missing a recovery key, has zero cohort members,
or hasn't journaled in 3 days. Live-chat surface deferred to
a dedicated brief.

### Cut 7 — Share cards + Quick-share presets (~400 lines)

`<ShareCard>` component (9:16 aspect, configurable assertion +
evidence + OTS stamp + verify URL). The Quick-share preset
catalog in Settings → Fresh. Existing ShareProofModal extended
to optionally render via ShareCard for screenshot-friendly
output.

### Cut 8 — Crew avatar bubbles (~250 lines)

Replace People tab list with `<FreshCrew>` — top-row avatar
bubbles, denser connection-card grid below, per-peer detail
sheet. Avatars use identicon derived from pubkey (deterministic
no-network), with the option to attach a display photo from
the diary later.

### Cut 9 — Streaks + polish (~200 lines)

Daily streak indicator in the Today header. Animation polish
across the Fresh surface — page transitions, micro-interactions
on tap, anchor-confirmation shimmers. Final accessibility
review.

Total estimate: nine cuts, roughly 2500 lines net new code
across two-to-three operator sessions if pushed hard, four-
to-five sessions at the comfortable five-cuts-per-session
rhythm. Each cut ships independently usable.

## Non-goals

- No fork. Classic stays default until the operator authorizes
  flipping the default.
- No compromise on the math-not-trust spine. Every cryptographic
  claim Fresh makes is the same claim Classic makes; only the
  presentation differs.
- No gamification of recovery. Streaks apply to journaling;
  cohort declaration and paper key reveal stay in Settings with
  the responsibility-acceptance framing intact.
- No crypto-bro register. The audience does not identify with
  that culture; the brief targets people who would never call
  themselves "early adopters" but who feel the platform-era
  cost every day.
- No tracking, no analytics, no third-party fonts loaded with
  identifying headers, no Google Fonts CDN. The same privacy
  bar Classic holds applies to Fresh.

## Success signals

What we'd measure if measurement were the goal (it isn't, the
wallet doesn't track users — these are first-pilot framings
for the operator's own read):

- Time from first-app-open to first-signed-entry. Target: under
  90 seconds for Fresh; today's Classic is roughly 3-5 minutes.
- Rate at which new wallets configure a recovery path (cohort
  OR paper key OR encrypted backup) within the first session.
  Target: above 70% for Fresh; harder to measure but the
  Recovery primer step is designed to lift it.
- Operator self-report on whether the wallet "feels like
  theirs." Hard to quantify, easy to notice in conversation.

What we'd notice without measuring:

- Does an operator screenshot a share card and send it to
  someone? Does that someone tap the verify URL? Word-of-mouth
  via screenshots is the audience's actual distribution channel.
- Does the dormant persona framework get used? Does Sage feel
  like a guide or a chatbot? The bot has to feel inevitable to
  the audience, not bolted on.
- Does the recovery-key paper backup conversion rate go up?
  This audience has watched too many friends lose accounts to
  not care about backup once they're shown it.

## Open questions for the operator

1. Font licensing — Editorial New / Recoleta / Berkeley Mono
   are commercial licenses. The brief specifies fallbacks
   (Recoleta → ui-serif, Berkeley Mono → JetBrains Mono) so
   the wallet ships without paid fonts; deciding which to
   license is operator-mode.
2. Sage's actual personality — name is a placeholder; the
   register and voice should be operator-authored, not
   manufactured from training data. The brief specifies the
   shape; the words come from the operator.
3. Whether to flip the Fresh-as-default switch ever. My read:
   ship Fresh, watch which one operators pick, decide later.
4. Whether the share-card OTS stamp shows the actual Bitcoin
   block height (more credible, more crypto-coded) or a
   plain-English "Verified to a specific moment on the
   Bitcoin chain" (less crypto-coded, less impressive). My
   recommendation: ship both, default to plain-English with
   an Advanced toggle to reveal the block.

## What the carpenter does next session

Cut 1 from the phasing list above. The Tailwind tokens, the
useTheme hook, the prefs.theme field, the Settings →
Appearance toggle. Foundation only. Confirms the theme-switch
architecture before any visual cuts start landing. Closes
clean as a one-cut session.

Subsequent cuts follow the phasing order. Operator may
re-order based on what's most valuable to see in browser
first.
