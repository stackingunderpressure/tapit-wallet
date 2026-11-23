import { describe, expect, it, vi, beforeEach } from 'vitest';

const { store } = vi.hoisted(() => ({ store: new Map<string, unknown>() }));
vi.mock('../../shared/lib/idb.ts', () => ({
  idb: {
    get: async (k: string) => store.get(k),
    put: async (k: string, v: unknown) => { store.set(k, v); },
    delete: async (k: string) => { store.delete(k); },
  },
}));

import { enableFaceUnlock, unlockWithFace, confirmFaceId, disableFaceUnlock, loadFaceUnlock, FaceUnlockUnavailable } from './faceUnlock.ts';

// A stand-in passkey: its PRF output is a fixed function of its own secret and
// the salt, the way a real authenticator's is.
let prfWorks = true;
let deviceSecret = 7;
let gets = 0;
async function prf(salt: ArrayBuffer | Uint8Array): Promise<ArrayBuffer> {
  const s = new Uint8Array(salt as ArrayBuffer);
  const data = new Uint8Array([deviceSecret, ...s]);
  return crypto.subtle.digest('SHA-256', data);
}
function install(mode: { cancelGet?: boolean } = {}) {
  (window as unknown as { PublicKeyCredential: unknown }).PublicKeyCredential = function () {};
  const rawId = new Uint8Array([1, 2, 3, 4]).buffer;
  Object.defineProperty(navigator, 'credentials', {
    configurable: true,
    value: {
      create: vi.fn(async () => ({ rawId, getClientExtensionResults: () => ({ prf: { enabled: prfWorks } }) })),
      get: vi.fn(async (o: { publicKey: { extensions: { prf: { eval: { first: Uint8Array } } } } }) => {
        gets++;
        if (mode.cancelGet) throw new DOMException('cancelled', 'NotAllowedError');
        const first = prfWorks ? await prf(o.publicKey.extensions.prf.eval.first) : undefined;
        return { rawId, getClientExtensionResults: () => ({ prf: first ? { results: { first } } : {} }) };
      }),
    },
  });
}

const OWNER = 'device-1';
const ID = 'ab'.repeat(32);
const PASS = 'my long passphrase';

describe('Face ID unlock', () => {
  beforeEach(() => { store.clear(); prfWorks = true; deviceSecret = 7; gets = 0; install(); });

  it('seals the passphrase on this device and gives it back after Face ID', async () => {
    const rec = await enableFaceUnlock(OWNER, ID, PASS);
    expect(JSON.stringify(rec)).not.toContain(PASS);
    expect(await loadFaceUnlock(OWNER)).toEqual(rec);
    expect(await unlockWithFace(rec)).toBe(PASS);
  });

  it('saves nothing when the browser gives no Face ID key', async () => {
    prfWorks = false;
    await expect(enableFaceUnlock(OWNER, ID, PASS)).rejects.toBeInstanceOf(FaceUnlockUnavailable);
    expect(await loadFaceUnlock(OWNER)).toBeUndefined();
  });

  it('a different passkey cannot open the seal', async () => {
    const rec = await enableFaceUnlock(OWNER, ID, PASS);
    deviceSecret = 9;
    await expect(unlockWithFace(rec)).rejects.toThrow(/could not be opened/);
  });

  it('asks for Face ID before a signature only when it is on', async () => {
    await confirmFaceId(OWNER);
    expect(gets).toBe(0);
    await enableFaceUnlock(OWNER, ID, PASS);
    gets = 0;
    await confirmFaceId(OWNER);
    expect(gets).toBe(1);
  });

  it('blocks the signature when Face ID is cancelled', async () => {
    await enableFaceUnlock(OWNER, ID, PASS);
    install({ cancelGet: true });
    await expect(confirmFaceId(OWNER)).rejects.toThrow();
  });

  it('turning it off removes the seal', async () => {
    await enableFaceUnlock(OWNER, ID, PASS);
    await disableFaceUnlock(OWNER);
    expect(await loadFaceUnlock(OWNER)).toBeUndefined();
    await confirmFaceId(OWNER);
  });
});
