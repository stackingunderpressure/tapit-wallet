import type { HandshakeView } from './createHandshake.ts';
import { relationshipLabel } from './relationshipOptions.ts';

interface Props {
  view: HandshakeView;
}

// THE SHARED HONEST RENDERER (operator audit, 2026-08-06): before this,
// a handshake's relationship / met-in-person / family-hint facts were shown
// on the in-person co-sign screen (HandshakeModal's i-preview) but silently
// dropped on the remote co-sign screen (EnvelopePreview, used by
// CosignAsWitnessModal for every Nostr-delivered connection) — the exact
// same signed claim, honestly shown on one review surface and invisible on
// the other, purely because two different components happened to render
// it. Both call sites now render THIS component instead of their own
// one-off block, so there is only one implementation of "what does this
// handshake claim" and the two screens cannot drift apart again.
//
// Renders nothing when the handshake carries none of these optional
// leaves — an older handshake, or one where the operator chose not to
// label it, shows no note, honestly.
export function HandshakeRelationshipNote({ view }: Props) {
  if (!view.relationship && !view.metInPerson && !view.familyHint && !view.amendedAt) {
    return null;
  }
  return (
    <div className="mt-3 rounded-md border border-ink/15 bg-ink/[0.02] px-3 py-2 text-sm space-y-1">
      {view.amendedAt && (
        <p className="text-xs font-medium text-accent">
          This updates an existing connection's relationship label.
        </p>
      )}
      {view.relationship && (
        <p>
          <span className="text-muted">Labelled as</span>{' '}
          <span className="font-medium">{relationshipLabel(view.relationship)}</span>.
        </p>
      )}
      {view.metInPerson && (
        <p className="text-xs text-muted">
          They said you met in person — their word, not proof.
        </p>
      )}
      {view.familyHint && (
        <p className="text-xs text-muted">
          Sent via an invite to the "{view.familyHint}" family.
        </p>
      )}
    </div>
  );
}
