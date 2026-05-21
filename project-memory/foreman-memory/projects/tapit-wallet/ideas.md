# Tapit Wallet — ideas

```
Date: 2026-05-18
Section: ideas
Entry: Hardware-wallet signing — the air-gapped QR path. The
user's Bitcoin hardware wallet becomes the wallet's signer: scan
a QR sign-request, confirm on the air-gapped device, scan the
response back. The key never touches an internet-connected
device.
Context: tapit-attest already uses BIP340 Schnorr over secp256k1
specifically to keep this path open. Connects to the
sovereign-credentials / tapit-signer-bridge thread in
AppCommander's ideas.md. Stage: raw.
Feature: wallet-core
```

```
Date: 2026-05-18
Section: ideas
Entry: Cloud-synced encrypted backup as the paid tier;
local-only backup stays free forever.
Context: backup-recovery is flagged monetizable: true. The host
only ever holds ciphertext, so charging for sync is charging for
convenience, not for access to the user's own data. Stage: raw.
Feature: backup-recovery
```

```
Date: 2026-05-18
Section: ideas
Entry: The wallet bot teaches the user their own attestation
history back — "here is what your wallet says about you, and who
vouched for it" — turning a holdings list into a narrative.
Context: An application of the fleet's teach-back pattern to the
wallet itself. Stage: raw.
Feature: wallet-bot
```

```
Date: 2026-05-18
Section: ideas
Entry: OpenTimestamps attestation anchoring (P1 in DISCOVERY.md).
Stamp held attestations into Bitcoin via OpenTimestamps and show
pending → confirmed (with block height) status, so an attestation
is tamper-evident in time and not only signature-valid.
Context: tapit-attest's current OpenTimestampsProvider wraps the
unverified `opentimestamps` npm package; the build should instead
add a provider behind the existing OtsProvider interface that
ports AppCommander's proven, dependency-free ots-stamp /
verify-ots-stamp protocol. See DISCOVERY.md "Honest notes".
Stage: sprouting.
Feature: wallet-core
```

```
Date: 2026-05-21
Section: ideas
Entry: Diary-first wedge reframe. The wallet's day-one product is a
cryptographically signed time-anchored personal diary — selfish use
case that does not require any network. Mycorrhizal partnerships
and the social layer accrue over weeks/months/years as a byproduct
of sustained use, not as preconditions. Bitcoin 2010 template: tip
forum users first, overthrow fiat later.
Context: Operator + AppCommander session brief, 2026-05-21. Source
of truth: project-memory/foreman-memory/projects/tapit-wallet/briefs/2026-05-21-diary-first-wedge.md
sections 1, 6, 9, 10, 14. Maps onto a proposed Phase 2.5: composer +
journal-kind attestation + entry cards on home + selective recall +
mocked anchor badge. Stage: sprouting — load-bearing reframe waiting
on Carpenter cutting decision.
Feature: wallet-core
```

```
Date: 2026-05-21
Section: ideas
Entry: Add a `journal` attestation kind to tapit-attest for daily
diary content, distinct from the existing `meta` kind which is
control-plane only (revocation / succession / death-declaration).
Cost: one line in src/types.ts AttestationKind union + one builder
export in src/core/builders.ts. Carpenter recommendation: do it,
the inverse-filter smell of "show me my meta minus the non-diary
events" is the signal of a missed type.
Context: Open question 1 from the 2026-05-21 diary-first brief.
Carpenter leans add-the-kind. Stage: matured — recommendation made,
awaiting operator decision.
Feature: wallet-core
```

```
Date: 2026-05-21
Section: ideas
Entry: Mycelial cascade recovery via Shamir Secret Sharing (SLIP-0039)
with no pre-stashed key — the operator's own sharpening. M-of-N
initiation by peers who verify the operator's face in person/video,
then every subscribed peer's wallet auto-encrypts its Shamir share
to the new keypair and pushes to recovery relays. Reassembly +
recovery-succession event signed by M peers makes the new key
authoritative going forward.
Context: Brief section 7. Technical clarification flagged by
Carpenter: the Shamir split must be over an encryption key for the
cloud-mirrored backup blob, NOT over the signing keypair, so M-of-N
collusion does not equal total identity capture. Stage: sprouting
— design is sharp; awaits MYCELIUM_NETWORK_SPEC + Phase 5
implementation.
Feature: backup-recovery
```

```
Date: 2026-05-21
Section: ideas
Entry: Three-shape succession chain — self-signed (planned
rotation), dual-signed (transitional window), peer-witnessed
recovery (M peers collectively sign that new key represents the
same identity after a loss event). All three resolve to "the
public key currently representing this identity."
Context: Brief section 7. The peer-witnessed shape is what makes
the cascade recovery design valid. Stage: sprouting — needs
implementation in tapit-attest's succession module for Phase 5.
Feature: wallet-core
```

```
Date: 2026-05-21
Section: ideas
Entry: Mycelium five-layer identity model — taproot (keypair),
mycorrhizal partnerships (peers), hyphal lattice (transitive trust),
anchoring rings (OTS receipts), forest consensus (years-deep soft
agreement). The wallet works at layer 1 alone on day one, accrues
layers as users add peers and entries.
Context: Brief section 2. Frame is useful for naming what each
phase delivers. Stage: matured — substrate doctrine.
Feature: wallet-core
```

```
Date: 2026-05-21
Section: ideas
Entry: Honest AI-defenses framing — the architecture closes forged
signatures, backdated forgeries, forged credentials, reputation
forgery by fresh keypairs, and post-theft impersonation. It does
NOT close unverified channels (largest residual gap), the cold-start
gap, sybil resistance, AI content inside real attestations,
coercion, key theft from compromised devices, or truth itself. User
framing: "this wallet does not stop AI from generating content in
your name. It gives the rest of the world a way to tell the
difference when they decide they want to know."
Context: Brief section 4. Stage: matured — copy substrate for
marketing + onboarding language.
Feature: wallet-core
```

```
Date: 2026-05-21
Section: ideas
Entry: Recovery as marketing moment — every recovery event is
implicit evidence to the M signing peers that running a wallet was
worth it. Network-effect surface. Carpenter pushback: design
recovery to work invisibly first and look inspiring second.
Dramatizing the ceremony adds friction for a real user sweating
about a decade of receipts. Marketing benefit is downstream of the
experience working, never upstream of it.
Context: Brief section 7 + Carpenter response. Stage: matured —
adopt the insight, hold the discipline.
Feature: backup-recovery
```

```
Date: 2026-05-21
Section: ideas
Entry: Bot's role is summarize-and-prompt, NEVER sign. The plain-
English approval screen is the last line of defense if the bot is
compromised or hallucinates. Phase 4 carpenter must hold this line
even when the bot's UX would feel smoother if it could sign on
behalf.
Context: Brief section 6 + Carpenter pushback. Stage: matured —
hard architectural rule for Phase 4.
Feature: wallet-bot
```

```
Date: 2026-05-21
Section: ideas
Entry: The "no better plan" rhetorical move — does anyone have a
better plan that preserves the first principle (you own your
identity, no platform)? Apple/Google hardware attestation, Worldcoin,
gov ID, W3C VCs, Sovrin/uPort, Bluesky AT Protocol, hardware
wallets — each does sub-problems better, each costs the first
principle. The architecture is choosing correctly on the
meta-problem and accepting being weaker on sub-problems that can
be ameliorated inside the architecture over years.
Context: Brief section 5. Stage: matured — copy substrate for
positioning + competitive conversations.
Feature: doctrine
```

```
Date: 2026-05-21
Section: ideas
Entry: CLAUDE_ROOT.md inheritance — the wallet now carries BOTH the
operational CLAUDE.md (Carpenter rulebook) AND CLAUDE_ROOT.md
(thesis-style orienting doctrine — non-negotiables, thesis, four
layers, doctrine map). CLAUDE_ROOT.md landed via AppCommander
bootstrap commit f61cf2d on 2026-05-21 and was merged into the
wallet branch by the Carpenter while filing this brief.
Context: Brief section 12 question 7. Stage: matured — file
present, doctrine map in place, no open action.
Feature: doctrine
```
