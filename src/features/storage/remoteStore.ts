import { supabase } from '../../shared/lib/supabase.ts';
import type { StoredBlob, WalletBlob } from './localStore.ts';

// Remote persistence — Supabase wallet_blobs row keyed by owner_id.
// Stores ciphertext + updated_at. The anon key + RLS policy is what
// gates access: a user can only read/write their own row. The host
// never holds a decryption key and cannot read the blob.
//
// 5e-iii-b-2: blob is the WalletBlob union (v1 EncryptedBlob OR v2
// RecoverableEncryptedBlob). The Supabase column stays a single
// JSONB cell; the `v` field inside discriminates the format.

interface Row {
  owner_id: string;
  blob: WalletBlob;
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
    return { blob: data.blob as WalletBlob, updated_at: data.updated_at };
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
