import type { Attestation, FieldBranch } from 'tapit-attest';

interface Props {
  attestation: Attestation;
}

// Render one attestation as a plain-English card. Phase 2 covers
// the identity kind in detail; other kinds (relationship, credential,
// agreement, prediction, meta) get rendered later phases as they
// land. The "Plain English everywhere" UI principle (DESIGN.md §9)
// means we never show a JSON dump.

function readString(claim: FieldBranch, name: string): string | undefined {
  const child = claim.children.find((c) => c.name === name);
  if (!child || child.node !== 'leaf') return undefined;
  return typeof child.value === 'string' ? child.value : undefined;
}

export function AttestationCard({ attestation }: Props) {
  const { claim } = attestation;
  const kindLabel = attestation.kind.charAt(0).toUpperCase() + attestation.kind.slice(1);

  if (attestation.kind === 'identity') {
    const displayName = readString(claim, 'display_name');
    const createdAt = readString(claim, 'created_at');
    return (
      <div className="rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
        <div className="text-xs uppercase tracking-wide text-muted">
          {kindLabel} attestation
        </div>
        {displayName && (
          <div className="mt-2 text-xl font-semibold">{displayName}</div>
        )}
        {createdAt && (
          <div className="mt-1 text-xs text-muted">
            Signed {new Date(createdAt).toLocaleDateString()}
          </div>
        )}
        <div className="mt-3 text-xs text-muted">
          Tier <span className="font-mono">{attestation.tier}</span> · self-signed
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white border border-ink/10 p-5 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-muted">
        {kindLabel} attestation
      </div>
      <div className="mt-2 text-sm">Tier {attestation.tier}</div>
    </div>
  );
}
