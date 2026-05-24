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
        // Inline backgroundColor + border so the cross-cutting Fresh
        // surface override (html[data-theme=fresh] div.bg-white {...})
        // does NOT swap this wrapper to the dark raised surface. QR
        // codes need stark white behind the dark pattern; without the
        // inline style the QR was rendering dark-on-dark and was
        // unreadable. Inline-style specificity (1,0,0,0) beats the
        // override's selector (0,0,2,2).
        className="mt-3 p-3 rounded-md inline-block"
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid rgba(15, 20, 25, 0.10)',
        }}
        // The SVG from the qrcode library is machine-generated
        // geometry with no user-controlled markup or script tags.
        // Safe to render as raw HTML.
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}
