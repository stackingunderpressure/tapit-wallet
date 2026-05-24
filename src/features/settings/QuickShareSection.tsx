import { lazy, Suspense, useMemo, useState } from 'react';
import type { Attestation } from 'tapit-attest';
import {
  enumerateQuickSharePresets,
  type QuickSharePreset,
} from '../disclosure/quickSharePresets.ts';

// QuickShareModal carries the ShareCard + the proof minter + the
// share-sheet wiring. Lazy-loaded so Classic operators (and Fresh
// operators who never open a preset) do not pay for the bytes.
const QuickShareModal = lazy(() =>
  import('../disclosure/QuickShareModal.tsx').then((m) => ({
    default: m.QuickShareModal,
  })),
);

// The Settings → Fresh → "Quick share" preset catalog. Cut 7 of
// the 2026-05-24 Fresh young-adult-friendly theme + IA roadmap.
// Lists the one-tap selective-disclosure presets the operator can
// generate from their existing holdings + identity attestation.
//
// Renders only under Fresh (the parent SettingsScreen wraps it in
// the same theme gate the AppearanceSection's Fresh-extras group
// uses). The preset enumerator is pure and idempotent, so this
// component re-renders cleanly whenever holdings or identity
// change.
//
// Brief asked for four presets; the two birthday-dependent ones
// (over 18 / over 21) are deferred because the existing identity
// attestation does not capture a birthday — the operator chose
// not to change the founding identity shape in this cut. The
// two available presets are "I have a verified profile" and
// one "I belong to {organization}" per held membership credential.

interface Props {
  identity: Attestation | null;
  holdings: readonly Attestation[];
}

export function QuickShareSection({ identity, holdings }: Props) {
  const presets = useMemo(
    () => enumerateQuickSharePresets(identity, holdings),
    [identity, holdings],
  );
  const [openPreset, setOpenPreset] = useState<QuickSharePreset | null>(null);

  return (
    <section className="mt-4 rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
      <div className="font-medium">Quick share</div>
      <p className="mt-1 text-sm text-muted">
        One-tap selective-disclosure cards designed for screenshotting
        and sending. Each card carries the assertion, the Bitcoin
        block stamp, and a verifier link. The receiver checks the math
        themselves — no trust in any platform required.
      </p>

      {presets.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          No presets are available yet. Once you have a founding
          identity attestation and at least one membership credential,
          the matching cards will appear here.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {presets.map((preset) => (
            <li key={preset.id}>
              <button
                type="button"
                onClick={() => setOpenPreset(preset)}
                className="w-full text-left rounded-xl border border-ink/15 bg-white/60 px-3 py-3 hover:bg-ink/[0.03] transition-colors"
              >
                <div className="text-sm font-medium">{preset.label}</div>
                <p className="mt-0.5 text-xs text-muted">{preset.subLabel}</p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {openPreset && (
        <Suspense fallback={null}>
          <QuickShareModal
            preset={openPreset}
            onClose={() => setOpenPreset(null)}
          />
        </Suspense>
      )}
    </section>
  );
}
