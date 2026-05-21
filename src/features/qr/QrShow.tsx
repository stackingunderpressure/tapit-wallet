import { useEffect, useState } from 'react';
import { encodeQrSvg } from './encodeQr.ts';

interface Props {
  text: string;
  /** Optional label shown above the QR. */
  label?: string;
}

// Render a string as an SVG QR code. Async render because the QR
// generator runs a non-trivial amount of math; spinner-message while
// it works. If the payload is too large to fit in a single QR code
// (~2.5KB binary at low error correction), the encoder throws and
// the UI surfaces a friendly message pointing at Share or Copy.
export function QrShow({ text, label }: Props) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setError(null);
    setSvg(null);
    encodeQrSvg(text)
      .then((s) => {
        if (alive) setSvg(s);
      })
      .catch((err) => {
        if (!alive) return;
        const msg = err instanceof Error ? err.message : 'could not render QR';
        // The qrcode library throws a "code length overflow" message
        // when the payload exceeds the largest QR version's capacity.
        if (/overflow|too big|too large/i.test(msg)) {
          setError(
            'This entry is too large to fit in one QR code. Use Share or Copy instead.',
          );
        } else {
          setError(msg);
        }
      });
    return () => {
      alive = false;
    };
  }, [text]);

  if (error) {
    return (
      <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        {error}
      </div>
    );
  }
  if (!svg) {
    return (
      <div className="mt-3 text-xs text-muted">Rendering QR…</div>
    );
  }
  return (
    <div className="mt-3">
      {label && (
        <div className="text-xs uppercase tracking-wide text-muted mb-2">
          {label}
        </div>
      )}
      <div
        className="bg-white p-3 rounded-md border border-ink/10 inline-block"
        // The SVG from the qrcode library is machine-generated
        // geometry with no user-controlled markup or script tags.
        // Safe to render as raw HTML.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}
