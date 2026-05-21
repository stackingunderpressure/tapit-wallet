-- Tapit Wallet — wallet_blobs table.
--
-- The encrypted-blob sync host. One row per user: the ciphertext of
-- their wallet snapshot plus an updated_at for last-write-wins
-- reconciliation against the local IndexedDB copy. The host NEVER
-- sees plaintext — encryption happens client-side via tapit-attest's
-- encrypt() before the row is inserted. The anon key + RLS policy
-- below is what gates access.

create table if not exists public.wallet_blobs (
  owner_id    uuid        primary key references auth.users(id) on delete cascade,
  blob        jsonb       not null,
  updated_at  timestamptz not null default now()
);

alter table public.wallet_blobs enable row level security;

-- Owner can read their own blob.
create policy "wallet_blobs select own"
  on public.wallet_blobs
  for select
  to authenticated
  using (auth.uid() = owner_id);

-- Owner can insert their own row.
create policy "wallet_blobs insert own"
  on public.wallet_blobs
  for insert
  to authenticated
  with check (auth.uid() = owner_id);

-- Owner can update their own row.
create policy "wallet_blobs update own"
  on public.wallet_blobs
  for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Index on updated_at supports cheap last-write-wins queries when
-- the client comes back from offline and reconciles.
create index if not exists wallet_blobs_updated_at_idx
  on public.wallet_blobs (updated_at);
