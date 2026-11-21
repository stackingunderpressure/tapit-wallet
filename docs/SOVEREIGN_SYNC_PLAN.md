# Sovereign sync: Tapit Wallet without a hosted database

Status: PLAN, decisions recorded (section 10, operator answers 2026-11-20).
No code written yet.

## 1. Goal

The sovereign build of Tapit Wallet runs with no Supabase at all. Everything
the wallet needs lives on the person's own device, and every backup goes to a
place they choose: a folder they sync themselves (Google Drive, Proton Drive,
iCloud Drive, Dropbox, OneDrive desktop app), a file they keep, or later a
direct Google Drive connection. The app says plainly where each piece of data
is, and when it was last saved, so nobody has to guess.

Principle: the wallet never depends on a company's server to keep or restore
someone's data, and it never claims more than the browser can actually know.

## 2. What Supabase does today

Five touchpoints, all in `src/features/storage` and `src/features/auth`:

| Piece | Table or bucket | Today |
|---|---|---|
| Encrypted wallet snapshot | `wallet_blobs` | Mirror of the local IndexedDB copy, last-write-wins on `updated_at` (`walletStore.ts`) |
| Circle phrase backups | `circle_phrase_backups` | Encrypted copy of the circle safety phrases |
| Request state | `request_state_backups` | Encrypted copy of dismissed and history request state |
| Media | `wallet_media` bucket | Encrypted attachments |
| Sign-in | Supabase auth (email code, password, Google and Apple) | Supplies `ownerId` and gates access |

The local side is already complete and encrypted: `walletStore.ts` writes the
blob to IndexedDB (database `tapit-wallet`) on every save and reads the
fresher of local and remote on load. Supabase is a second copy plus the
sign-in gate. That is why removing it is mostly a change of destination, not
a rewrite of the wallet.

## 3. Target design

### 3.1 One backup interface

`walletStore` keeps its job as the coordinator. Its remote half becomes a
list of **backup targets**, each implementing the same small contract:

- `put(ownerId, record)`: store an already-encrypted record, return the time
  it was saved and whether it was read back and matched.
- `get(ownerId)`: return the stored record and its `updated_at`, or nothing.
- `describe()`: a plain-language name and where it lives, for the status screen.

Targets in order of delivery:

1. **This device only** (IndexedDB). Always on. Not a backup on its own.
2. **Backup file** (download and upload of one encrypted `.tapit-backup`
   file). Works in every browser and on phones through the share sheet.
3. **Folder** (File System Access API). The person picks a folder inside any
   synced desktop folder. Chromium browsers on a computer only; the app shows
   "not available in this browser" everywhere else.
4. **Google Drive app-data** (OAuth, scope limited to the app's own hidden
   area). Needs Google's review of the sign-in consent before wide use.
5. Later, if wanted: Dropbox or OneDrive through their own browser APIs.

Conflict rule stays last-write-wins on `updated_at`, the same as today. If two
targets disagree, the app shows both timestamps and asks, rather than
silently picking one.

### 3.2 Identity without a sign-in service

Today `ownerId` comes from Supabase. In the sovereign build it has to come
from the wallet itself. Proposed: a stable identifier derived from the
wallet's own public key (for example a hash of the identity public key), so
the same wallet always has the same id on every device and in every backup.
The unlock passphrase stays the only way in. Open question: confirm the exact
derivation with the code before writing it, because `ownerId` is also used
as a storage key today.

### 3.3 What is removed in the sovereign build

- The sign-in screens, the OAuth buttons, the sign-in number flow and the
  session refresh. The unlock screen replaces them.
- Every import of `supabase()` in the sovereign build. The hosted build keeps
  its current code until section 9 is decided.
- The remote media and request-state stores are replaced by local storage
  plus the same backup targets.

## 4. Showing people where their data is

This is the part the operator asked for most, and it is mostly screens and
copy, not new storage.

**A "Where your data lives" screen**, reachable from Settings and from the
home screen when something is out of date. One row per kind of data (wallet,
circle phrases, messages, attachments, request history). Each row shows:

- where the copy is: "this phone", "backup file", "your folder: <name>";
- when it was last saved;
- whether it was read back and matched (see 4.3).

**A backup health line on the home screen**, plain words only:
- "Backed up to <place>, 2 minutes ago, checked."
- "Saved on this phone only. Not backed up yet." (the honest default)
- "Last backup was 45 days ago." (after a set number of days, configurable)

**A first-run choice**, skippable but repeated until answered: "Where should a
backup of your wallet go?" with the options from 3.1 and a plain sentence for
each, including what happens if the device is lost under each choice.

**A short education layer**, consistent with how the app already teaches
(Sage, the education chips):
- what "encrypted before it leaves this phone" means, and that the storage
  company only ever holds scrambled data;
- what a backup file is, where to keep it (not in the same place as the
  device, not in a photo album that is shared by default);
- the honest limits, in one screen: browsers and phones can clear site
  storage; a provider's own sync is not something the app can see; losing the
  passphrase cannot be fixed by anyone, including us.

**A restore check**, one button: "Test my backup." It reads the backup back,
decrypts it with the passphrase in memory, and reports success without
changing anything. This turns "I think I'm backed up" into something a person
has actually tested.

## 5. Keeping the data from being wiped

The app never deletes data on its own. The risks are outside the app, so the
plan is to ask for the right things and say so:

- **Request persistent storage** (`navigator.storage.persist()`) on first
  unlock, and show whether the browser granted it. Browsers may refuse; the
  app reports the answer rather than assuming it.
- **Encourage installing the app to the home screen.** On iPhone and iPad,
  Safari can remove a website's storage after about seven days without a
  visit unless the site is installed. The install prompt should say why.
- **Warn before clearing site data.** The app cannot stop "clear browsing
  data" from working, but the status screen should say what would be lost.
- **Backups are the real protection.** Persistent storage makes accidental
  loss less likely; a tested backup is what survives a lost or broken phone.

## 6. Security notes

- Every backup is encrypted on this device before it is written anywhere. The
  storage provider sees a file name, a size and a time, never the contents.
  The file name should be generic, not the wallet's name.
- A stolen backup file can be attacked offline with guesses at the passphrase.
  Before writing code, confirm the key-derivation settings used by the current
  encrypted blob format (the v2 format is referenced in `remoteStore.ts`) and
  whether they are strong enough for a file that may sit in a cloud account
  for years.
- Restoring from a file must check integrity before it replaces anything, and
  must never overwrite a newer local copy without asking.
- Nostr relays remain third-party servers that carry encrypted messages. They
  are the main network surface left in the sovereign build and should be named
  as such on the status screen.

## 7. Phases

- **P0, decisions** (section 10). No code.
- **P1, backup file and status screen.** Encrypted export and import, the "Where
  your data lives" screen, the home-screen health line, "Test my backup", and
  the persistent-storage request. Works in the hosted build too, so existing
  users can take a file out now. Tests in section 8.
- **P2, folder target** for Chromium desktop browsers.
- **P3, sovereign build auth seam.** `ownerId` from the wallet key, sign-in
  screens removed in the sovereign flavor, `supabase()` absent from that build's
  bundle (checked by a build-time test, not by eye).
- **P4, Google Drive app-data target**, after Google's consent review.
- **P5, migration help for hosted users**, if section 9 chooses it.

Each phase ships on its own and each can be reverted without touching the
others.

## 8. Tests that must exist before a phase is called done

- Export then import on a fresh profile returns the identical wallet.
- Wrong passphrase, a flipped byte, and a truncated file are each refused, and
  none changes local data.
- A restore never replaces a newer local copy without an explicit choice.
- Two targets with different timestamps show both and ask; they never merge
  silently.
- The sovereign build's bundle contains no Supabase client (a build check).
- The status screen's words match the stored state (a test on each state:
  never backed up, backed up and checked, backed up and not checked, stale).

## 9. Hosted build: decide what happens to today's users

Options, to be decided by the operator:

- **A. Leave the hosted build as it is**, with the new backup file and status
  screen added, and tell users how to take a file out whenever they like.
- **B. Move hosted users to the sovereign model** through a one-time export
  step and a clear date, with the hosted service kept read-only for a set time.
- **C. Retire the hosted build** once the sovereign build is at parity.

Recommendation: A now, then decide between B and C once P1 to P3 have run
for a while. Forcing a migration before the sovereign build has been used by
real people would cost trust we haven't earned yet.

## 10. Decisions (operator answers, 2026-11-20)

1. Replace the hosted build with the sovereign build (not a separate build).
   Consequence: the hosted users must move, so section 9 option B is needed.
2. Recovery is the backup file plus the passphrase only. No recovery service,
   no email reset, no recovery phrase.
3. Hosted users move on a set date (section 9, option B). The date and the
   export step still need to be set.
4. First targets: backup file and folder. Google Drive after review.
5. A stale backup is nudged after 30 days.

Consequences to act on before P3: the hosted service must stay readable long
enough for every user to export their wallet and backup, the export step
must work before Supabase is switched off, and the migration date must be
decided with the users in mind. Section 9's earlier recommendation (keep
hosted for now) no longer applies.

Original questions, for reference:

1. Confirm the sovereign build is separate from the hosted build (recommended)
   rather than replacing it.
2. Confirm the recovery design: the backup file plus the passphrase is the
   only recovery path in the sovereign build. No recovery service, no email
   reset.
3. Choose section 9 option A, B or C for hosted users.
4. Confirm the first targets: backup file (everywhere) and folder (Chromium
   desktop). Google Drive after review.
5. Confirm how often the app should nudge a stale backup (suggested: 30 days).

## 11. Limits, stated plainly

- The app cannot see whether a provider has finished syncing a file to other
  devices. The status says "saved to <folder>", never "synced everywhere".
- The folder option does not work in Safari or Firefox, or on iPhone.
- Browser storage can be cleared by the person, by a browser setting, or by the
  phone under storage pressure. Persistence is requested, never guaranteed.
- Nothing here recovers a lost passphrase.
