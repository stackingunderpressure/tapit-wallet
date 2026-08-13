-- Tapit Wallet — circle_phrase_backups table.
--
-- Operator, 2026-08-13: "Anything that saved like that should be saved
-- into the supabase not just the local storage of that browser...
-- everything should be encrypted on the storage so that if you switch
-- browsers or phones or whatever you didn't lose anything." The circle
-- safety-phrase registry (circlePhrase.ts) had lived in this browser's
-- IndexedDB only, with no cloud mirror at all -- a lost phone or a
-- different browser genuinely lost every phrase pair a wallet had ever
-- received, with no way back. Same pattern as wallet_blobs: one row per
-- user, ciphertext only, encrypted client-side via tapit-attest's
-- encrypt() before the row is ever written. The host never sees a
-- phrase, a hash, or a salt in the clear -- only the same opaque blob
-- already stored locally.

create table if not exists public.circle_phrase_backups (
  owner_id    uuid        primary key references auth.users(id) on delete cascade,
  blob        jsonb       not null,
  updated_at  timestamptz not null default now()
);

alter table public.circle_phrase_backups enable row level security;

-- Owner can read their own blob.
create policy "circle_phrase_backups select own"
  on public.circle_phrase_backups
  for select
  to authenticated
  using (auth.uid() = owner_id);

-- Owner can insert their own row.
create policy "circle_phrase_backups insert own"
  on public.circle_phrase_backups
  for insert
  to authenticated
  with check (auth.uid() = owner_id);

-- Owner can update their own row.
create policy "circle_phrase_backups update own"
  on public.circle_phrase_backups
  for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Index on updated_at supports cheap last-write-wins queries when
-- the client comes back from offline and reconciles.
create index if not exists circle_phrase_backups_updated_at_idx
  on public.circle_phrase_backups (updated_at);
