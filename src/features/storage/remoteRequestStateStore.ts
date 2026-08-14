import { supabase } from '../../shared/lib/supabase.ts';
import type { EncryptedBlob } from 'tapit-attest';

// Remote persistence for dismissedRequestsStore.ts and
// requestHistoryStore.ts -- mirrors circle-phrase's
// remoteCirclePhraseStore.ts pattern, generalized since both local
// stores share the same (ownerId, namespace) -> JSON-array shape.
// Keyed by owner_id + a caller-chosen store_key (e.g.
// "dismissed-requests:psbt-cosign") so one table covers every
// namespace both stores use without a row per namespace turning into
// a bespoke table each. Supabase never sees plaintext -- the caller
// encrypts with the wallet's own passphrase-derived key before this
// module ever touches it, same as every other cloud mirror in this
// app, even though the LOCAL copies of this data are already
// unencrypted by design (requestHistoryStore.ts's own header: "no
// different in sensitivity from what dismissedRequestsStore already
// keeps in the clear") -- CLAUDE.md's stack section still states
// "the host only ever stores ciphertext" as a blanket rule for this
// app's Supabase usage, not a sensitivity-gated one, so this keeps
// that true without a special-cased plaintext exception.
// See 20260814000001_create_request_state_backups.sql.

interface Row {
  owner_id: string;
  store_key: string;
  blob: EncryptedBlob;
  updated_at: string;
}

export const remoteRequestStateStore = {
  async get(ownerId: string, storeKey: string): Promise<EncryptedBlob | undefined> {
    const { data, error } = await supabase()
      .from('request_state_backups')
      .select('blob')
      .eq('owner_id', ownerId)
      .eq('store_key', storeKey)
      .maybeSingle();
    if (error) throw error;
    if (!data) return undefined;
    return data.blob as EncryptedBlob;
  },
  async put(ownerId: string, storeKey: string, blob: EncryptedBlob): Promise<void> {
    const row: Row = {
      owner_id: ownerId,
      store_key: storeKey,
      blob,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase()
      .from('request_state_backups')
      .upsert(row, { onConflict: 'owner_id,store_key' });
    if (error) throw error;
  },
};
