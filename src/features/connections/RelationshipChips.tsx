// Relationship chip picker for the handshake flow — extracted from
// HandshakeModal to keep that file under the 800-line hard limit. The
// option list + label helper live in relationshipOptions.ts so this stays
// a component-only file (react-refresh).
import { RELATIONSHIPS } from './relationshipOptions.ts';

// Chip picker for the optional relationship leaf. Tapping a chip toggles
// its selection — picking the same chip again clears the label entirely so
// the leaf is omitted from the envelope. The picker writes to the parent's
// `relationship` state which the build* functions read at signing.
export function RelationshipChips({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="mt-3">
      <div className="text-xs text-muted">How do you know them? (optional)</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {RELATIONSHIPS.map((r) => {
          const selected = value === r.value;
          return (
            <button
              key={r.value}
              type="button"
              onClick={() => onChange(selected ? '' : r.value)}
              aria-pressed={selected}
              className={
                'rounded-full border px-3 py-1 text-xs font-medium transition ' +
                (selected
                  ? 'border-ink bg-ink text-paper'
                  : 'border-ink/15 bg-white text-ink hover:bg-ink/[0.04]')
              }
            >
              {r.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
