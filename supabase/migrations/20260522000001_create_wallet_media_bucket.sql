-- Tapit Wallet — wallet_media storage bucket.
--
-- When a user has cloud-sync turned ON in Settings, the wallet
-- mirrors each entry's encrypted attachment bytes to this bucket
-- so a lost phone can be restored on a new device. The bytes are
-- ciphertext — the wallet encrypts them client-side via
-- tapit-attest's `encrypt()` before any upload — so this bucket
-- stores opaque JSON-wrapped EncryptedBlob objects and never sees
-- plaintext photos or documents.
--
-- Storage object paths follow the convention `<owner_id>/<sha256-hex>.json`
-- where the sha256-hex is the same hash that the attestation's
-- Merkle field tree commits to as a leaf. The first folder segment
-- is the auth.uid() of the owner, which is what the RLS policies
-- below match against — every user can only see their own folder.

-- Idempotent bucket creation. `public = false` means objects are not
-- world-readable; the RLS policies below are what actually gate
-- access for authenticated users.
insert into storage.buckets (id, name, public)
values ('wallet_media', 'wallet_media', false)
on conflict (id) do nothing;

-- Owner can read their own media. storage.foldername(name) returns
-- the folder path as a text[]; element 1 is the first segment which
-- is our `<owner_id>` convention.
create policy "wallet_media select own"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'wallet_media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner can upload to their own folder.
create policy "wallet_media insert own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'wallet_media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner can replace their own objects. The wallet upserts on save
-- so the same hash overwrites cleanly; this also allows a future
-- re-encryption flow if the user rotates their passphrase.
create policy "wallet_media update own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'wallet_media'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'wallet_media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Owner can delete their own objects. The wallet UI doesn't expose
-- delete yet but the policy is here for completeness — when the
-- user removes an entry locally they should be able to remove the
-- mirrored media too.
create policy "wallet_media delete own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'wallet_media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
