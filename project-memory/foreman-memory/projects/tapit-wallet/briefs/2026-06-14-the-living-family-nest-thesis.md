# The Living Family Nest — coherent thesis

Date: 2026-06-14
Author: carpenter, from the operator's 2026-06-14 riff (game-night + story-
attestation + "tile all the necessary veins into one coherent thesis")
Status: thesis / north-star framing. Not a build spec. The build specs are the
narrow veins this document tiles together (see "The veins, tiled" below).

## The one sentence
Tapit is the living, breathing place a family chooses to be a family — a
sovereign nest each member holds in their own wallet, where the everyday warmth
(games, "how was your day," claps and hugs, Grandma's stories) is the same
surface that quietly carries the serious load (the secure channel, the
family-owned AI context, the can't-be-locked-out secrets, the family memory
that outlives everyone), and where everything that happens is the family's own,
encrypted to each member's wallet, certifiable forever, and nobody can be locked
out because the family lets each other back in — and no one else.

## Why this thesis, why now
The operator keeps describing the same body from different angles, and each
angle alone reads as a "narrow vein" — the secrets condo, the camera, the
heartbeat, the host-bot, the story. This document is the operator's explicit
ask: stop walking each vein separately and tile them into the coherent whole,
because the whole is the point and the veins are just how it gets built. The
2026-06-14 sovereign-family-nest landscape research independently confirmed the
whole is real whitespace: every brick exists siloed, the integrated daily-use
family nest that is also secure channel + family AI context + social-recovery
secrets + scales-to-civic does not exist anywhere. This thesis names that whole
so every future cut can be checked against it.

## The core reframe: the everyday IS the security
Every competitor treats the warm everyday surface and the high-stakes security
surface as different products. Cozi/Skylight/Hearth are the warm everyday hub
(but cloud SaaS the vendor reads, never sovereign). 1Password/Bitwarden/
Trustworthy are the secrets vault (but special-purpose, opened at tax time or
death, never daily). The thesis is that these must be ONE surface, because the
everyday warmth is what earns the trust and builds the habit that makes the rare
high-stakes moment land on a rail the family already lives on. People text their
SSN because iMessage is already open. The fluffy layer is not a distraction from
sovereignty — it is the delivery vehicle for it. The beaten path carries the
serious cargo precisely because it is beaten.

## The new keystone mechanism: the STORY-ATTESTATION
The operator's 1945 example is not a cute feature — it is the mechanism that
fuses warmth, memory, AI-context, sovereignty, and permanence into one act.
Walk it through:
- The family sets an intent in the wallet ("we want to teach finance," "we want
  our history preserved"). Settings are sovereign and per-family.
- The host-bot, reading that intent, asks Grandma to tell the story of what
  money was like in 1945 — a warm, personal, no-pressure prompt, not a form.
- Grandma tells it. The telling is captured (voice/video/text via the in-app
  camera + capture pipeline that already exists).
- That telling becomes a signed attestation: certified as Grandma (her key),
  anchored in time (OpenTimestamps), locked into the family vault memory.
- It is the same file 300 years from now — replayable, verifiable, tamper-
  evident. "We can all certify that was Grandma; play it again and it's the
  same."
- It would otherwise have died with her. The act of asking + capturing +
  certifying is what moves a piece of irreplaceable family knowledge from
  fragile oral memory into sovereign permanent memory.
- And it feeds the family-owned AI context: the story becomes part of the
  family's own knowledge the family selectively exposes — teaching the next
  generation, answerable by the family's bot, never surveilled, never the
  vendor's.

So one warm prompt produces, in a single act: an emotional family moment, a
preserved piece of oral history, a verifiable personal attestation, a permanent
vault entry, and a contribution to the family's own AI knowledge. That is the
thesis in miniature — warmth and sovereignty are the same act, not a trade-off.

This generalizes: the "powwow" — elder-to-member, generation-to-generation
knowledge transfer that modern life has eroded — becomes a first-class,
bot-prompted, attestation-producing ritual. Family history as a teaching
mechanism, certified and permanent. The bot is the patient grandchild who
always remembers to ask, and the wallet is the hearth that never forgets the
answer.

## The veins, tiled (how the existing/planned work maps to the whole)
- Per-member wallet + the family nest living across all of them — the Mycelium
  peer network (Layer 3) is the substrate; each member holds their own keys; the
  "family" is the web of trust among them, encrypted to each wallet.
- The host-bot — fully configurable per person AND able to address the whole
  group OR each person individually with the same underlying interest. One brain,
  many voices: a shared host plus per-person bots (the game-show host + each
  player's earpiece). This is the family-AI-context pillar wearing a warm face.
- Games / "how was your day" / milestone claps+hugs — the everyday engagement
  layer; the no-shame non-response rule is firewalled from the heartbeat's
  cessation-as-signal (the fun layer NEVER surveils silence; the safety layer
  does, and only there).
- Story-attestations / family oral history — the keystone above; reuses the
  capture → sign → anchor pipeline and the vault.
- Pull-up-the-files / hub-of-apps sync (dentist appointment, schedules) — the
  sovereign answer to Cozi/Skylight coordination, self-custodied.
- Secure channel for the sensitive stuff (SSN, docs, a kid needing a credential)
  — rides the same everyday app; adopt the proven expiring/view-limited E2EE
  share shape (Psst!/Secure-Link), don't reinvent.
- Family-owned AI context, de-duped + selectively exposed — stop the household
  re-asking and re-paying for the same question; the most open pillar per the
  research; the per-person bots + the story corpus are its raw material.
- Can't-be-locked-out secrets with social recovery — held-pieces (B-1) +
  heartbeat/liveness (B-2) + recall-brake (delay+veto). "No one gets locked out
  because we will all let them back in, but we won't let anyone else back in."
  That sentence is the threshold-recovery design goal stated in family language.
- Scaling to civic proof — the same nest that proves "this is our family and we
  agree that's who we are" scales to prove church/library/town membership and
  local voting. Bottom-up, peer/community-attested, the opposite of top-down
  institutional DID.

## The identity claim at the heart of it
"This is the family unit that puts us together and makes us who we are because
we all agree that's who we are and that's what we want." That is the deepest
line in the riff. The family is not defined by a vendor's account structure or a
government's record — it is constituted by mutual attestation. The members agree,
cryptographically and warmly, that they are a family; that agreement IS the
nest; and it is sovereign because it is bottom-up, self-custodied, and
revocable/re-grantable only by the members themselves. Privacy and sovereignty
are not features bolted on — they are the precondition for the agreement meaning
anything.

## What this changes for prioritization
The research said the everyday surface is the wedge. This thesis says the
story-attestation is the wedge's sharpest point — it is the single act that most
vividly demonstrates "warmth and sovereignty are the same thing," it reuses
infrastructure that already exists (capture, sign, anchor, vault), and it
produces something a family viscerally does not want to lose. A strong case
exists for an early cut around bot-prompted story capture → attestation → vault,
as the emotional proof-of-concept of the whole nest, before more secrets
hardening. Decide this with the operator when the next big arc is chosen.

## North-star test for every future cut
For any proposed feature, ask: does it make the family want to come home to the
nest (warmth), AND does it leave the family a little more sovereign — more their
own, more permanent, more impossible to be locked out of (sovereignty)? A cut
that does only one is half done. That is the mission's two-jobs rule, stated for
the family nest.
