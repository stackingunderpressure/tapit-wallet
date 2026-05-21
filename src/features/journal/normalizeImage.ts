// Normalize an image File so it renders consistently across devices.
// iPhones capture in HEIC by default. Safari can render HEIC in
// <img> tags but Chrome-on-Android and most desktop browsers
// cannot. If we store the raw HEIC bytes, your wife's photo signed
// on iPhone will not display when your daughter opens the same
// entry on her Android device — a real cross-device-portability
// footgun.
//
// This helper passes through formats every browser can render
// (JPEG / PNG / WebP / GIF) and re-encodes everything else
// (HEIC, HEIF, TIFF, etc.) to JPEG at 0.92 quality via a canvas.
// On Safari iOS the HEIC source decodes natively in the <img>
// element so the canvas re-draw works without any extra library.
//
// The output File has the same logical name as the input with a
// .jpg suffix swapped in, so save-to-files downloads use the
// portable extension.

const RENDERABLE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export async function normalizeImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  if (RENDERABLE_MIMES.has(file.type)) return file;

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('could not decode the photo on this device'));
      i.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d context missing');
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('canvas toBlob returned null'))),
        'image/jpeg',
        0.92,
      );
    });
    const baseName = (file.name || 'photo').replace(/\.[^.]+$/, '');
    return new File([blob], `${baseName}.jpg`, {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
