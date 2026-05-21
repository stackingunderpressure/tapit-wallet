import type { Attestation, FieldBranch } from 'tapit-attest';

interface Props {
  attestation: Attestation;
}

// Renders a parsed attestation as a plain-English preview for the
// signing-witness flow. The witness sees what they are about to
// commit to — never raw JSON, never hex blobs. Per DESIGN.md §9 UI
// principle: "Sign requests render as 'Acme Insurance is asking
// you to confirm you are over 21' — never a JSON dump or a hex
// string."
//
// Supports the journal-kind shape (subject + text + category +
// optional photo hash). Other kinds get a minimal fallback —
// kind / tier / subject / signers — until later phases.

function readString(claim: FieldBranch, name: string): string | undefined {
  const child = claim.children.find((c) => c.name === name);
  if (!child || child.node !== 'leaf') return undefined;
  return typeof child.value === 'string' ? child.value : undefined;
}

function shortKey(s: string): string {
  if (s.length <= 16) return s;
  return `${s.slice(0, 8)}…${s.slice(-4)}`;
}

export function EnvelopePreview({ attestation }: Props) {
  const text = readString(attestation.claim, 'text');
  const category = readString(attestation.claim, 'category') ?? 'Diary';
  const writtenAt = readString(attestation.claim, 'written_at') ?? attestation.issuedAt;
  const photoHash = readString(attestation.claim, 'photo_sha256');

  const kindLabel = attestation.kind.charAt(0).toUpperCase() + attestation.kind.slice(1);
  const subjectLabel = attestation.subject.length > 32
    ? shortKey(attestation.subject)
    : attestation.subject;

  return (
    <div className="rounded-md border border-ink/15 bg-paper p-4">
      <div className="text-xs uppercase tracking-wide text-muted">
        {kindLabel} · {category}
      </div>
      <div className="mt-2 text-sm">About: <span className="font-medium">{subjectLabel}</span></div>
      <div className="mt-1 text-xs text-muted">
        Originally written {new Date(writtenAt).toLocaleString()}
      </div>
      {text && (
        <p className="mt-3 whitespace-pre-wrap text-sm">{text}</p>
      )}
      {photoHash && (
        <p className="mt-3 text-xs text-muted">
          Includes a photo (not shown — only the signer who created the entry
          has the photo bytes). The signature commits to the photo's hash.
        </p>
      )}
      <div className="mt-3 text-xs text-muted">
        Already signed by{' '}
        {attestation.signatures.length === 0
          ? 'no one yet'
          : attestation.signatures.length === 1
            ? `1 signer (${shortKey(attestation.signatures[0]?.signer ?? '')})`
            : `${attestation.signatures.length} signers`}
      </div>
    </div>
  );
}
