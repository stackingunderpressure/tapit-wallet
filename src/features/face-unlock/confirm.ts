// Before a signature: if Face ID is on, pass it again (faceUnlock.ts). Kept
// tiny and loading the rest on demand, so every screen that signs can call it
// without carrying the Face ID code in its own bundle.
export async function confirmFaceId(ownerId: string): Promise<void> {
  const { confirmFaceId: run } = await import('./faceUnlock.ts');
  await run(ownerId);
}
