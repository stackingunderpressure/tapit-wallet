import QRCode from 'qrcode';

// Render a text payload as an SVG QR code string. SVG so it scales
// crisp on retina displays and can be styled with CSS. Low-error-
// correction level ('L') maximizes the data capacity per QR
// version, which is what matters for envelope JSON that runs
// 500-1500 bytes. If a payload is larger than the largest QR can
// hold (~2.5KB binary at level L), the underlying library throws;
// the caller surfaces the error as "this entry is too large for a
// QR code; use Share or Copy instead."
export async function encodeQrSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: 'svg',
    errorCorrectionLevel: 'L',
    margin: 1,
  });
}
