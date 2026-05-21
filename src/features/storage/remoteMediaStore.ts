import { supabase } from '../../shared/lib/supabase.ts';
import type { EncryptedBlob } from 'tapit-attest';

// Encrypted-media mirror to Supabase Storage. Each object is a JSON
// wrapping { blob, mime } where `blob` is the same `EncryptedBlob`
// tapit-attest's `encrypt()` produced; the host stores ciphertext
// only. Path convention: `<owner_id>/<sha256-hex>.json` so the RLS
// policy in 20260522000001_create_wallet_media_bucket.sql can scope
// each user to their own folder via storage.foldername(name)[1].

const BUCKET = 'wallet_media';

function path(ownerId: string, hashHex: string): string {
  return `${ownerId}/${hashHex}.json`;
}

interface Wrapped {
  blob: EncryptedBlob;
  mime: string;
}

export const remoteMediaStore = {
  /** Upload an encrypted media blob. Upserts on the same hash. */
  async put(
    ownerId: string,
    hashHex: string,
    blob: EncryptedBlob,
    mime: string,
  ): Promise<void> {
    const wrapped: Wrapped = { blob, mime };
    const body = new Blob([JSON.stringify(wrapped)], { type: 'application/json' });
    const { error } = await supabase()
      .storage.from(BUCKET)
      .upload(path(ownerId, hashHex), body, {
        contentType: 'application/json',
        upsert: true,
      });
    if (error) throw error;
  },

  /** Download an encrypted media blob. Returns undefined if missing. */
  async get(
    ownerId: string,
    hashHex: string,
  ): Promise<Wrapped | undefined> {
    const { data, error } = await supabase()
      .storage.from(BUCKET)
      .download(path(ownerId, hashHex));
    if (error) {
      const msg = error.message?.toLowerCase() ?? '';
      if (msg.includes('not found') || msg.includes('does not exist')) {
        return undefined;
      }
      throw error;
    }
    const text = await data.text();
    return JSON.parse(text) as Wrapped;
  },

  /** Delete a remote object. The wallet's UI doesn't call this yet. */
  async delete(ownerId: string, hashHex: string): Promise<void> {
    const { error } = await supabase()
      .storage.from(BUCKET)
      .remove([path(ownerId, hashHex)]);
    if (error) throw error;
  },
};
