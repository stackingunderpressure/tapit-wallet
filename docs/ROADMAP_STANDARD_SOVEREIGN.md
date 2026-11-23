# Roadmap: from one family to an organization — Standard and Sovereign

Status: ROADMAP (operator, 2026-11-23). Covers Tapit Wallet and DynastyTrust
together. Built-vs-gap claims below were read from tapit-wallet main and
DynastyTrust origin/main on 2026-11-23; anything not checked says so.

## 1. The vision, in the operator's words

> "My original vision is an organization having identity tied to social
> acceptance and that social acceptance gate used also to sign the 'petition'
> to move funds of the organization through dynasty. With security members as
> hardware wallet duty to provide a layer of security with quorums pre agreed
> upon. Pipe dream maybe but my ultimate vision from solo family up to
> organization up to as far as possibly useful."

> "Proof of concept on a good infrastructure with all the things we can do
> done and honest on gaps is my goal." Sovereign: "no need to go crazy … I
> just like the option."

## 2. The ladder

One person's Tapit identity, carried up through every size of group, with
DynastyTrust holding the money:

| Rung | Who | Money rule (Bitcoin enforces) | Social layer (people decide) |
|---|---|---|---|
| Solo | one person | one key now; recovery and heir keys after a timelock | — |
| Couple | two people | both, or either after a delay | each other |
| Family | parents, heirs | founders' quorum; heirs after a deadline | trusted helpers, circle phrases |
| Generational trust | trustees, beneficiaries, protector | trustee quorum; protector path; scheduled distributions | trust document, requests |
| Organization | members, officials, security members | security members' hardware quorum | members petition; officials ratify |

DynastyTrust already ships vault templates for the first four rungs plus a
business treasury (`vault-templates.ts`: solo-savings, couples,
family-inheritance, generational-trust, operating/capital/sweep categories).

## 3. The organization model

1. **Identity by social acceptance (Tapit).** A person's wallet is their
   identity. They join an organization by the org's join policy: vouched for
   by existing members, approved by officials, or open. Built in Tapit:
   organizations, memberships that nest, officials roster, vouching circle,
   join policies, authorization rules shaped like Taproot leaves
   (`features/connections`, `features/governance`).
2. **The petition.** Moving organization funds starts as a petition: a
   proposal that members sign with their Tapit identity. The org's rules say
   how many, and which, members must sign, for example "5 members, at least
   one official".
3. **Security members.** A small, pre-agreed group holds hardware wallets.
   Once the petition passes, they review it and sign the actual Bitcoin
   transaction. Bitcoin enforces their quorum.
4. **Recovery and succession.** Timelocked paths for when security members
   are lost: a protector key, or the org's successor keys after a deadline.

### The honest part

Bitcoin enforces only the key quorum. The petition is people agreeing; on its
own it is enforced by the app and by the security members' discipline, not by
Bitcoin. Two ways to make it binding, from cheapest:

- **Procedural.** DynastyTrust refuses to build a transaction until the
  petition passes, and shows security members the signed petition on the
  signing screen. Stops honest mistakes; a determined quorum of security
  members can still bypass it.
- **A petition key.** One key in the vault's quorum belongs to a signer that
  only signs after verifying the petition: valid member signatures, the org's
  rules, the right amount and destination. Then Bitcoin itself needs the
  petition. Tapit already has the verification pieces for gated release
  (`features/identity-gate`: release authority and gated-release checks). The
  hard question is who runs that signer: a Tapit wallet held by an official,
  or a small always-on service; each has trade-offs written out before build.

## 4. Two tracks: Standard and Sovereign

Asked once at the start, changeable later without rebuilding a vault.

| | Standard | Sovereign |
|---|---|---|
| For | people who want strong security with a company's convenience | people who want no one to hold their data |
| Keys | always yours; DynastyTrust never holds them | same |
| Coordination | DynastyTrust's servers | your devices and Nostr (Tapit already works this way) |
| Who can see what | the company: whatever is not encrypted on your device; aim is ciphertext only (section 6, P2) | relays see little; Tor hides your address |
| Recovery help | sign-in recovery, support | your backup file and recovery key only |
| Work for you | low | more: backups, Tor or Orbot, optional own node or relay |
| Said plainly | "A company runs the servers. It can't move your coins. It could be compelled to hand over what it stores." | "No one can restore it for you." |

Sovereign stays an option, not the main road. It gets a guide, not a second
product.

## 5. What is built today

Tapit Wallet:
- Sovereign by default: no account, no server; wallet on the device.
- Complete backup file, opens with the passphrase or the recovery key; tested.
- Face ID unlock and Face ID before every signature.
- Identity, connections, organizations, memberships, officials, vouching,
  join policies, authorization rules, gated release.
- Encrypted messaging over Nostr; strangers flagged; public profile opt-in.
- Signs DynastyTrust spend requests and sign-ins over Nostr.

DynastyTrust:
- Taproot multileaf vaults with timelocked recovery and inheritance paths;
  templates through business treasury.
- Proposals with comments and votes; governance status and audit.
- Hardware signing (SeedSigner, Nunchuk) via PSBT and QR; network warnings.
- Tapit co-signing, vault invites and circle phrases over Nostr.
- Encrypted vault messages; Legacy Recovery published on-chain.

## 6. Roadmap — proof of concept first

**P1. Finish what is in flight (privacy basics).**
- Ship Nostr metadata Phase 1 (built and held: DynastyTrust branch
  `claude/nostr-phase1-giftwrap`, Tapit e83334c).
- Phases 2–3 of `docs/NOSTR_METADATA_PLAN.md`.

**P2. Standard track on good infrastructure (the default product).**
- Zero-knowledge storage in DynastyTrust: vault details, proposals, amounts,
  destinations, PSBTs and comments encrypted on the device; the server keeps
  ciphertext and random IDs; delete PSBTs after broadcast.
- Accounts without identity: username plus passkey or wallet key, no email.
- Balance lookups that don't hand addresses to one third party (own node or
  Tor).
- A "what each party can see" screen.

**P3. Organization proof of concept on signet.**
- Org vault template: security members' hardware quorum + protector +
  successor timelock.
- Petition: a DynastyTrust proposal that members sign from Tapit; the org's
  rules from Tapit decide when it passes; the signing screen shows it.
- Start procedural (section 3); then build the petition key on signet.
- End-to-end on signet: org formed in Tapit, members vouched in, petition
  passes, security members sign on hardware, funds move. Every path walked.

**P4. Sovereign option.**
- Tapit: done. Add a Tor switch in the native app.
- DynastyTrust: the one-person download app (already planned), then
  coordination over Nostr for families who choose it.
- A short guide: Tor or Orbot, own node, own relay, self-hosted server.

**P5. Native apps.** Tapit via TestFlight (`docs/NATIVE_IOS_PLAN.md`), then
DynastyTrust, under the company's Apple account.

## 7. Honest gaps

- The petition is not enforced by Bitcoin until the petition key exists.
- DynastyTrust's database today holds vault details, proposals and comments
  readable by whoever runs it (P2 closes this).
- A vault's Tapit key is the wallet's Nostr identity, linking on-chain spends
  to it (`docs/VAULT_KEY_SEPARATION_PLAN.md`).
- Websites can be made to serve someone a tampered app; only signed downloads
  or native apps fix that (P4, P5).
- Hardware wallets can't read a petition; security members must check it on
  the DynastyTrust screen, which is why the petition key matters.
- No end-to-end testnet spend yet with real separate signers on separate
  devices for the org shape (P3).
- Legal: a petition is not a legal instrument; an organization still needs its
  own governing documents. Not checked: any jurisdiction's rules on this.

## 8. Decisions for the operator

1. Petition enforcement for the proof of concept: procedural first, then
   petition key (recommended), or petition key from the start.
2. Who runs the petition key: an official's Tapit wallet (no server, needs a
   person online) or a small always-on signer (automatic, but a service).
3. Order of P2 and P3: privacy first (recommended), or the org proof of
   concept first to show the vision sooner.
