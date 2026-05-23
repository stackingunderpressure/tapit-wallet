import { supabase } from '../../shared/lib/supabase.ts';
import type { AnyEncryptedBlob, StoredBlob } from './localStore.ts';

// Remote persistence — Supabase wallet_blobs row keyed by owner_id.
// Stores ciphertext + updated_at. The anon key + RLS policy is what
// gates access: a user can only read/write their own row. The host
// never holds a decryption key and cannot read the blob.
//
// Phase 5e-iii-b-2 — blob is AnyEncryptedBlob (v1 legacy or v2
// recoverable). Supabase stores the JSON as-is; the v field
// distinguishes the format at read time.

interface Row {
  owner_id: string;
  blob: AnyEncryptedBlob;
  updated_at: string;
}

export const remoteStore = {
  async get(ownerId: string): Promise<StoredBlob | undefined> {
    const { data, error } = await supabase()
      .from('wallet_blobs')
      .select('blob, updated_at')
      .eq('owner_id', ownerId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return undefined;
    return { blob: data.blob as AnyEncryptedBlob, updated_at: data.updated_at };
  },
  async put(ownerId: string, value: StoredBlob): Promise<void> {
    const row: Row = {
      owner_id: ownerId,
      blob: value.blob,
      updated_at: value.updated_at,
    };
    const { error } = await supabase()
      .from('wallet_blobs')
      .upsert(row, { onConflict: 'owner_id' });
    if (error) throw error;
  },
};
