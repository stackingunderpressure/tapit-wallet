-- Tapit Wallet — request_state_backups table.
--
-- Operator, 2026-08-14, after re-signing in and seeing a wall of
-- already-reviewed DynastyTrust spend requests come back looking
-- brand new: "They are all old... we can anticipate it would happen
-- again." dismissedRequestsStore.ts and requestHistoryStore.ts --
-- the two stores that make an already-handled psbt-cosign or
-- vault-membership request stay gone -- lived in this browser's
-- IndexedDB only, keyed by ownerId (the stable Supabase auth user
-- id). ownerId itself doesn't change across a sign-out/sign-in, but
-- the local IndexedDB data can still be lost independently of that --
-- a storage partition eviction, a fresh browser, a reinstalled PWA --
-- and once it's gone, a relay's routine backlog replay of every
-- historical event this wallet's pubkey was ever addressed under
-- (subscribePsbtCosignRequests has no `since` cutoff, by design) has
-- nothing left to check against, so every request the operator ever
-- reviewed floods back looking unhandled. Same pattern as
-- circle_phrase_backups: ciphertext only, encrypted client-side
-- before the row is ever written, the host never sees which
-- requests existed or what was decided about them.
--
-- One row per (owner, store_key) rather than one row per owner --
-- dismissedRequestsStore and requestHistoryStore each cover two
-- namespaces today (psbt-cosign, vault-membership), and store_key
-- names which local IDB key a row mirrors (e.g.
-- "dismissed-requests:psbt-cosign") so this one table covers every
-- namespace both stores use without a bespoke table per namespace.

create table if not exists public.request_state_backups (
  owner_id    uuid        not null references auth.users(id) on delete cascade,
  store_key   text        not null,
  blob        jsonb       not null,
  updated_at  timestamptz not null default now(),
  primary key (owner_id, store_key)
);

alter table public.request_state_backups enable row level security;

-- Owner can read their own rows.
create policy "request_state_backups select own"
  on public.request_state_backups
  for select
  to authenticated
  using (auth.uid() = owner_id);

-- Owner can insert their own rows.
create policy "request_state_backups insert own"
  on public.request_state_backups
  for insert
  to authenticated
  with check (auth.uid() = owner_id);

-- Owner can update their own rows.
create policy "request_state_backups update own"
  on public.request_state_backups
  for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Index on updated_at supports cheap last-write-wins queries when
-- the client comes back from offline and reconciles.
create index if not exists request_state_backups_updated_at_idx
  on public.request_state_backups (updated_at);
