# Carpenter state — for Foreman's eyes

**Operator-mode note:** AppCommander down. Operator running
manual against live Netlify + Supabase deploy. Dual-surface
comms active.

---

## WHAT-CHANGED-RECENTLY

**Landing copy shipped into the login screen** (`083ee21`),
branch `claude/compare-library-wallet-OW5FF`.

The operator wanted a landing surface capturing sovereignty —
self-custody of identity, refusing to rent it from a company,
and the circle of people who keep an identity correctly
attributed and unfakeable — explicitly WITHOUT government or
identity-document framing. Decision: a wallet PWA has no
separate marketing site, its front door is the login screen, so
the message went into `LoginPage.tsx`'s email step rather than a
new route. The email step now leads with a Tapit Wallet
wordmark, the headline "The record of your life belongs to
you.", and a moving paragraph, then the email field. This is
persistent on every login, unintrusive, and vanishes on auth —
all three of the operator's placement instincts at once. The
`<form>` was restructured to wrap only the input + button.
All four gates green. Copy was operator-approved before the cut.

A condensed one-line email version was handed to the operator
to paste into the Supabase sign-in email template — operator-
side, not a repo file.

## Gates at session end

**Root:** typecheck / lint / test (19/19 across 5 test files) /
build all green. tapit-attest unchanged 82/78/0/4. Largest
wallet file still WalletProvider.tsx (~290 lines), under the
400-line warn tier.

## WHAT'S-PENDING

1. **Operator-side, in progress:** Resend custom-SMTP setup.
   DNS records (DKIM TXT, MX, SPF TXT) being entered into the
   Northwest Registered Agent DNS panel; nameservers are
   `hosting.businessidentity.llc`. Operator reported the records
   in and propagating. Once Resend verifies the domain, plug its
   SMTP credentials into Supabase Authentication → Custom SMTP,
   and raise Supabase's own email rate limit under Auth → Rate
   Limits.
2. **Operator-side:** add the `{{ .Token }}` variable to the
   Supabase Magic Link email template (for the 6-digit code),
   and paste the one-line landing message into the same
   template.
3. **Deploy decision:** commit `083ee21` is on the branch only.
   Operator to decide whether it also goes to main so the live
   Netlify deploy picks up the landing copy.
4. **Copy review:** the landing paragraph is five sentences —
   operator to eyeball it on a real phone and decide whether to
   trim; flagged in carpenter-opinions.md.
5. **Non-blocking follow-ups** unchanged: multi-tab worker
   coordination, OTS fixture restoration (4 skipped library
   tests), Tap-it-Attest-main.zip cleanup, backfill remote
   media for pre-Cut-2 entries.
6. **Phase 5** (Mycelium + Shamir recovery) still waits for
   MYCELIUM_NETWORK_SPEC.md.

## WHAT-TO-FLAG

**Field verification is now actively happening and going
well.** The operator reported a diary entry that completed end
to end on the live deploy and a selfie attestation correctly
showing as pending (anchor confirming async — working as
designed). This is the first feature-level confidence the
project has had; previously everything was gate-level only.

**LoginPage.tsx now carries two jobs** — auth flow AND the
landing/brand statement. Correct for this stage, but a future
refactor of the auth logic must not accidentally gut the
landing copy. Noted, not a problem today.

**The email plumbing is the last thing between v1 and real
users.** Once Resend verifies and Supabase custom SMTP is wired,
the rate-limit wall that blocks sign-up clears. Everything else
in the v1 surface is shipped and, increasingly, field-verified.

## RECOMMENDED-NEXT-MOVES

1. Operator finishes the Resend domain verification, wires
   Supabase custom SMTP, raises the Supabase email rate limit.
2. Operator pastes `{{ .Token }}` plus the landing one-liner
   into the Supabase email template.
3. Operator decides whether `083ee21` goes to main for the live
   deploy, and eyeballs the landing copy length on a phone.
4. Phase 5 holds for MYCELIUM_NETWORK_SPEC.md.

## OPERATOR'S-CURRENT-VIBE

Energized and in flow. The operator browser-verified real
features working on the live deploy and expressed genuine
excitement about what was built and its significance. The work
has shifted from building features to deploy plumbing (custom
SMTP, DNS) and polish (the landing copy). The operator is
moving fast, working ahead of the conversation, and values
clear step-by-step guidance through the operator-side
infrastructure tasks. Expect the next messages to be either
Resend/Supabase setup checkpoints or a reaction to the landing
copy on the live screen.

## Ideas ready to revisit

All earlier idea entries hold. Updated this session:

- **The login screen as the landing page.** Established this
  session: a wallet PWA's philosophy surface and its product
  surface are the same screen. The landing copy is not a promise
  about the future — it describes what happens to the user in
  the next sixty seconds. This affirm-what-is-true-now framing
  is reusable for any future onboarding surface.

- **Affirm-then-sign pattern** (from the identity ceremony)
  still holds as a reusable structure for future commitment
  moments — relationship attestations, agreements, witness
  statements.

- **Two lower-value guardrail candidates** (total-bytes ceiling,
  manifest touches-accuracy) remain available, deliberately not
  cut, per non-negotiable #3.

The 16+ earlier idea entries are stage-tagged in
`project-memory/foreman-memory/projects/tapit-wallet/ideas.md`.
