# Carpenter state — for Foreman's eyes

**Operator-mode note:** AppCommander down. Operator running
manual against live Netlify + Supabase deploy. Dual-surface
comms active.

---

## WHAT-CHANGED-RECENTLY

**Elegant restyle of the login / landing screen** (`ff5c37e`),
branch `claude/compare-library-wallet-OW5FF`.

The operator saw the landing copy live, called it "very very
very plain", and asked for elegance — shading, colour, life,
"like we're actually changing the world". Commit `ff5c37e`
restyles both the email and code steps via a new `Frame`
component: a frosted, elevated, rounded card on the warm paper
field, two soft drifting colour glows behind it (accent green +
warm amber), a serif display headline, a gradient accent button
with a colour-tinted shadow, refined inputs with a soft focus
ring, a gradient hairline divider, an accent-dot wordmark, and a
gentle rise-in on mount. `tailwind.config.ts` gained a serif
font family (system serif stack, zero network cost) and
rise/float keyframes + animations. Stayed inside the existing
paper/ink/accent palette — no new brand colours. All motion
respects prefers-reduced-motion. All four gates green.

Note: this is a visual change verified only by
typecheck/lint/test/build — none can see pixels, and Tailwind
silently drops unknown classes. Build-verified, NOT
Carpenter-pixel-verified. The operator verifies on the live
deploy.

## Gates at session end

**Root:** typecheck / lint / test (19/19 across 5 test files) /
build all green. tapit-attest unchanged 82/78/0/4. CSS chunk
grew slightly with the new utilities, still within bundle
budget. Largest wallet file still WalletProvider.tsx
(~290 lines); LoginPage.tsx is ~265 lines, under the 400-warn
tier.

## WHAT'S-PENDING

1. **Operator-side, in progress:** Resend custom-SMTP setup.
   DNS records (DKIM TXT, MX, SPF TXT) being entered into the
   Northwest Registered Agent DNS panel (nameservers
   `hosting.businessidentity.llc`). Operator reported records in
   and propagating. Once Resend verifies, wire its SMTP creds
   into Supabase Auth → Custom SMTP and raise Supabase's email
   rate limit under Auth → Rate Limits.
2. **Operator-side:** add `{{ .Token }}` to the Supabase Magic
   Link email template and paste the one-line landing message
   into it.
3. **Deploy decision:** commits `083ee21` (landing copy) and
   `ff5c37e` (restyle) — landing copy already on main as of the
   last push; the restyle `ff5c37e` is branch-only pending the
   operator's go to main.
4. **Visual review:** the restyle is build-verified only.
   Operator to eyeball glow strength, headline size, and the
   five-sentence paragraph length on a real phone; all three
   are quick dials if taste wants them.
5. **Non-blocking follow-ups** unchanged: multi-tab worker
   coordination, OTS fixture restoration (4 skipped library
   tests), Tap-it-Attest-main.zip cleanup, backfill remote
   media for pre-Cut-2 entries.
6. **Phase 5** (Mycelium + Shamir recovery) still waits for
   MYCELIUM_NETWORK_SPEC.md.

## WHAT-TO-FLAG

**Carpenter has no way to see UI changes.** Visual work is
verified only by gates that cannot render pixels, and Tailwind
drops unknown classes silently. Every UI change currently leans
entirely on the operator's phone loop. A headless-screenshot
capability in the Carpenter sandbox would close this gap —
flagged as a [FEEDBACK→Foreman] item this session.

**The login screen now carries three jobs** — auth flow, the
landing/brand statement, and the visual identity of the product.
A future refactor of any one must not gut the others. The
restyle is well-isolated in a `Frame` component, which helps.

**The restyle is offered as a draft made real.** Glow strength,
headline size, and paragraph length are taste calls the operator
should make on the live screen; the Carpenter expects one round
of visual redirection and that is healthy, not rework.

## RECOMMENDED-NEXT-MOVES

1. Operator views the restyle on the live deploy and redirects
   the visual direction if wanted.
2. Operator finishes Resend verification, wires Supabase custom
   SMTP, raises the email rate limit, updates the email template.
3. Operator decides whether `ff5c37e` goes to main.
4. If the look lands, extend the `Frame` treatment to the
   passphrase, unlock, and identity-ceremony screens for
   consistency.
5. Phase 5 holds for MYCELIUM_NETWORK_SPEC.md.

## OPERATOR'S-CURRENT-VIBE

Energized, in a tight visual-iteration loop, deploying and
verifying on a phone in near-real-time. The operator moved from
feature-building to deploy plumbing and now to polish, and cares
visibly about the product feeling worthy of its mission —
"changing the world" is the bar being set for the look. Expect
the next message to be a reaction to the restyle (likely one
round of "softer / bigger / shorter") or a Resend/Supabase
setup checkpoint. The operator is happy with the work and
moving fast.

## Ideas ready to revisit

All earlier idea entries hold. Updated this session:

- **The login screen as landing page, marketing, and visual
  identity all at once.** A wallet PWA has no separate website,
  so its front door does the work of all three. Worth keeping in
  mind: design investment here has outsized return because it is
  the only marketing surface.

- **A shared pre-wallet `Frame` shell.** The elegant Frame built
  this session for login could become the consistent treatment
  for every pre-unlock screen (passphrase, unlock, identity
  ceremony), giving the whole entry experience one coherent
  premium feel. Surfaced as a next-move candidate.

- **Affirm-then-sign pattern** and the **two lower-value
  guardrail candidates** still hold from earlier sessions.

The 16+ earlier idea entries are stage-tagged in
`project-memory/foreman-memory/projects/tapit-wallet/ideas.md`.
