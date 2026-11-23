# Native iPhone app for Tapit Wallet — Build Note

Status: PLAN, awaiting operator decisions (section 3). No native code written.
Written 2026-11-23 after reading the repo as it is at 95d69d4.

## 1. The ask (operator's words)

> "If installed as a pwa how long will data last. Is there anything more we
> can do" … "How hard is 5" (wrap as a real iPhone app) … "I have a company
> already set up." … "I have a Mac." … "Both, small slice first."

The small slice shipped (95d69d4). This note is the second half.

## 2. What would be built

The existing web app, unchanged in its core, wrapped as a real iPhone app with
Capacitor, distributed to the family through TestFlight under the company's
Apple Developer account. The native parts exist only to fix what a web page on
an iPhone cannot do:

1. **Automatic backup.** After every wallet save, the app writes the same
   version 3 backup file (encrypted on the phone; opens with the passphrase or
   the recovery key) to an iCloud Drive folder, with no tap. The backup line on
   home then reads "Backed up automatically 2 min ago".
2. **Face ID through Apple's keychain.** The passphrase copy is sealed in the
   iOS keychain behind Face ID (LocalAuthentication), replacing the web passkey
   trick inside the app. Unlock and every signature ask Face ID, as now.
3. **Links open the app.** DynastyTrust's /sign?req=… links open the app
   instead of Safari (Universal Links on tapit-wallet.netlify.app).
4. **Durable storage.** The app's data lives in the app's own container, not
   under Safari's storage rules.

Same code ships to the web site as today; the native pieces switch on only
inside the app.

## 3. Decisions that are the operator's

1. **App name and bundle id.** Proposed: "Tapit Wallet", bundle id
   `com.<company-domain>.tapit`. Needs the company's domain/legal name.
2. **Where automatic backups go.** (a) A visible "Tapit Wallet" folder in
   iCloud Drive, seen in the Files app (recommended: you can see it, copy it,
   and the encrypted file is useless without the passphrase or key); or (b) the
   app's hidden iCloud container.
3. **How many backups to keep.** Recommended: the last 10 plus one per month,
   oldest pruned.
4. **Face ID in the app.** Recommended: Apple keychain + Face ID inside the app;
   the web site keeps the passkey version.
5. **Universal Links.** Recommended yes: adds one public file to the web site
   (`/.well-known/apple-app-site-association`).

## 4. Blast radius (read from the code, not memory)

Files and surfaces downstream of the change:

- `package.json` + new `ios/` folder (Capacitor project, Xcode settings,
  entitlements: iCloud Documents, Associated Domains, Face ID usage string).
- `src/features/face-unlock/*` — gains a native branch (keychain) beside the
  web passkey one; `confirmFaceId` (called before every signature in
  SignApprovalScreen, IncomingVaultMembershipBanner, FamilyRatifyModal,
  CosignAsWitnessModal) keeps one entry point.
- `src/features/storage/walletStore.ts` — save path triggers the automatic
  backup; `src/features/settings/fullBackup.ts` builds the file unchanged.
- `src/features/settings/BackupNowLine.tsx` — wording for automatic backups.
- `src/features/wallet-core/checkForUpdate.ts` — fetches `/version.json` by
  relative path; inside the app the origin is the app itself, so this must
  point at the web site or be turned off in the app (app updates come through
  TestFlight instead).
- `src/features/sign-request/approveRequest.ts` — redirects to the request's
  callback URL with `window.location.href`; inside the app that must open the
  calling app/browser, not navigate the wallet away.
- Nostr transport, relays, messaging, inbox: unchanged (browser websockets work
  in the app).
- Netlify site: one new public file for Universal Links; nothing else.
- Data: the app starts EMPTY — its storage is separate from Safari and from the
  home-screen web app. The wallet is brought in once from a backup file (the
  "Bring in my wallet" card shipped in 95d69d4).
- Promise to the human: "your wallet backs itself up" becomes true only for
  the app, and only to iCloud — the Guide and Known limitations must say so.
- Gates: CI keeps building the web flavor; the iOS build is checked by Xcode on
  the operator's Mac (cannot run on the Linux CI).
- Apple: company developer account ($99/yr), TestFlight builds expire after 90
  days and must be refreshed.

## 5. Deliberately left out

- App Store release to the public (TestFlight for the family only).
- Android native app.
- DynastyTrust native app (later, same account).
- Any change to the wallet's encryption, key handling or backup format.
- Push notifications.
- Removing the web site or the home-screen web app; both stay.

## 6. Slices, once decisions are in

1. Capacitor shell + build checklist; app opens, Nostr connects, restore from
   file works. (Operator builds once on the Mac.)
2. Automatic iCloud Drive backup + backup line wording.
3. Keychain Face ID.
4. Universal Links + callback handling in the app.
5. Guide / Known limitations copy.
