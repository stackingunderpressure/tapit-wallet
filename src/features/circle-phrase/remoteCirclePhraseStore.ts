import { supabase } from '../../shared/lib/supabase.ts';
import type { EncryptedBlob } from 'tapit-attest';

// Remote persistence for the circle-phrase registry — mirrors
// storage/remoteStore.ts's wallet_blobs pattern exactly. Supabase
// circle_phrase_backups row keyed by owner_id. Stores ciphertext +
// updated_at; the host never holds a decryption key and cannot read
// a phrase, a hash, or a salt. See 20260813000001_create_circle_phrase_backups.sql.

interface Row {
  owner_id: string;
  blob: EncryptedBlob;
  updated_at: string;
}

export const remoteCirclePhraseStore = {
  async get(ownerId: string): Promise<EncryptedBlob | undefined> {
    const { data, error } = await supabase()
      .from('circle_phrase_backups')
      .select('blob')
      .eq('owner_id', ownerId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return undefined;
    return data.blob as EncryptedBlob;
  },
  async put(ownerId: string, blob: EncryptedBlob): Promise<void> {
    const row: Row = {
      owner_id: ownerId,
      blob,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase()
      .from('circle_phrase_backups')
      .upsert(row, { onConflict: 'owner_id' });
    if (error) throw error;
  },
};
