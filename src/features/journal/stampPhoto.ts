// Composite a verification badge into the corner of a COPY of a photo, for
// the "stamped copy on share" path (operator, 2026-06-05: "have the metadata
// lock up in the corner of the picture"). The original signed + anchored
// bytes in mediaStore are never touched — this draws onto a fresh canvas from
// the displayed image and hands back a new JPEG blob to share or save.
//
// The badge carries what the operator asked for: a small Tapit mark + the
// capture date, who captured it, the Bitcoin block once the timestamp has
// confirmed, and a scannable QR that resolves to the /verify page with the
// disclosure proof. The QR is the load-bearing part — the visible text is
// human-readable context, but the QR is what lets anyone re-run the math and
// confirm the signature + anchor.
//
// qrcode is imported dynamically so it only loads when the operator actually
// stamps a photo (it already ships as its own chunk for QrShow).

export interface StampInfo {
  /** Who captured it — operator display name / handle. */
  name: string;
  /** Human-readable capture date, pre-formatted by the caller. */
  dateText: string;
  /** Bitcoin block height once the timestamp confirmed; omit while pending. */
  btcHeight?: number;
  /** URL the corner QR encodes — the /verify link with the proof inline. */
  verifyUrl: string;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

async function qrDataUrl(text: string, sizePx: number): Promise<string | null> {
  try {
    const QRCode = (await import('qrcode')).default;
    return await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'L',
      margin: 1,
      width: sizePx,
    });
  } catch {
    // Payload too large for a QR, or the library failed — drop the QR and
    // keep the text badge. The verify link still travels with the share text.
    return null;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('could not load the photo to stamp'));
    img.src = src;
  });
}

/**
 * Draw the verification badge onto a copy of the image at `sourceUrl` and
 * return a new JPEG blob. Throws only if the image cannot be decoded or the
 * canvas is unavailable; a too-large QR degrades gracefully to a text badge.
 */
export async function stampPhoto(
  sourceUrl: string,
  info: StampInfo,
): Promise<Blob> {
  const img = await loadImage(sourceUrl);
  const W = img.naturalWidth || img.width;
  const H = img.naturalHeight || img.height;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context missing');
  ctx.drawImage(img, 0, 0, W, H);

  // Everything scales off the short edge so the badge reads the same on a
  // square crop or a tall phone shot.
  const min = Math.min(W, H);
  const pad = Math.round(min * 0.022);
  const qr = Math.round(min * 0.16);
  const titleFont = Math.round(min * 0.03);
  const bodyFont = Math.round(min * 0.024);
  const lineGap = Math.round(bodyFont * 0.45);
  const margin = pad;

  const qrUrl = await qrDataUrl(info.verifyUrl, qr);
  const qrImg = qrUrl ? await loadImage(qrUrl) : null;

  // Build the text lines, skipping the block line until it confirms.
  const lines: { text: string; font: number; bold: boolean }[] = [
    { text: 'Tapit · Verified by math', font: titleFont, bold: true },
  ];
  if (info.name) lines.push({ text: info.name, font: bodyFont, bold: false });
  if (info.dateText) lines.push({ text: info.dateText, font: bodyFont, bold: false });
  lines.push({
    text:
      typeof info.btcHeight === 'number'
        ? `Bitcoin block ${info.btcHeight.toLocaleString()}`
        : 'Anchoring to Bitcoin…',
    font: bodyFont,
    bold: false,
  });

  // Measure the widest line to size the panel.
  let textW = 0;
  for (const l of lines) {
    ctx.font = `${l.bold ? '600 ' : ''}${l.font}px system-ui, sans-serif`;
    textW = Math.max(textW, ctx.measureText(l.text).width);
  }
  const textBlockH =
    lines.reduce((sum, l) => sum + l.font, 0) + lineGap * (lines.length - 1);

  const qrW = qrImg ? qr + pad : 0;
  const panelH = Math.max(qrImg ? qr + pad * 2 : 0, textBlockH + pad * 2);
  const panelW = pad + qrW + textW + pad;
  const panelX = margin;
  const panelY = H - margin - panelH;

  // Panel background — translucent dark so it reads over any photo.
  ctx.fillStyle = 'rgba(17, 17, 17, 0.62)';
  roundRect(ctx, panelX, panelY, panelW, panelH, Math.round(pad * 0.9));
  ctx.fill();

  // QR on a white tile so scanners get clean contrast.
  let textX = panelX + pad;
  if (qrImg) {
    const qrX = panelX + pad;
    const qrY = panelY + (panelH - qr) / 2;
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, qrX - 4, qrY - 4, qr + 8, qr + 8, 6);
    ctx.fill();
    ctx.drawImage(qrImg, qrX, qrY, qr, qr);
    textX = qrX + qr + pad;
  }

  // Text block, vertically centered in the panel.
  let y = panelY + (panelH - textBlockH) / 2;
  ctx.textBaseline = 'top';
  for (const l of lines) {
    ctx.font = `${l.bold ? '600 ' : ''}${l.font}px system-ui, sans-serif`;
    ctx.fillStyle = l.bold ? '#c0fc4d' : '#f5f5f5';
    ctx.fillText(l.text, textX, y);
    y += l.font + lineGap;
  }

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas toBlob returned null'))),
      'image/jpeg',
      0.92,
    );
  });
}
