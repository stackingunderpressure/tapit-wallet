import type { Attestation, FieldBranch } from 'tapit-attest';
import { isHandshake, readHandshake } from '../connections/createHandshake.ts';

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
// optional attachment hash) and the handshake (relationship-kind)
// shape — handshakes get a name-forward preview so the witness
// sees who's connecting with whom, not raw pubkeys. Other kinds
// get a minimal fallback — kind / tier / subject / signers —
// until later phases.

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
  // Handshakes render with parties' names front and center so the
  // witness sees "Ada and Charles are connecting" rather than a
  // pubkey under "About". The verification tier is named in plain
  // English alongside.
  if (isHandshake(attestation)) {
    const v = readHandshake(attestation);
    const initiator = v.initiatorName || 'Unknown';
    const responder = v.responderName || 'Unknown';
    const verificationLabel =
      v.verification === 'remote'
        ? 'Remote connection'
        : 'In-person connection';
    const when = v.handshakeAt
      ? new Date(v.handshakeAt).toLocaleString()
      : new Date(attestation.issuedAt).toLocaleString();
    const cosigned = attestation.signatures.length >= 2;
    return (
      <div className="rounded-md border border-ink/15 bg-paper p-4">
        <div className="text-xs uppercase tracking-wide text-muted">
          Connection · {verificationLabel}
        </div>
        <div className="mt-2 text-sm">
          <span className="font-medium">{initiator}</span>
          {' '}↔{' '}
          <span className="font-medium">{responder}</span>
        </div>
        <div className="mt-1 text-xs text-muted">Recorded {when}</div>
        <div className="mt-3 text-xs text-muted">
          {cosigned
            ? "You've both said yes."
            : 'One of you has said yes — your yes finishes it.'}
        </div>
      </div>
    );
  }

  const text = readString(attestation.claim, 'text');
  const category = readString(attestation.claim, 'category') ?? 'Diary';
  const writtenAt = readString(attestation.claim, 'written_at') ?? attestation.issuedAt;
  const attachmentHash = readString(attestation.claim, 'attachment_sha256');
  const attachmentMime = readString(attestation.claim, 'attachment_mime');

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
      {attachmentHash && (
        <p className="mt-3 text-xs text-muted">
          Includes a{' '}
          {attachmentMime?.startsWith('image/') ? 'photo' : 'document'}{' '}
          (not shown — only the person who made it has it). Approving
          locks in its fingerprint so it can't be swapped later.
        </p>
      )}
      <div className="mt-3 text-xs text-muted">
        Approved by{' '}
        {attestation.signatures.length === 0
          ? 'no one yet'
          : attestation.signatures.length === 1
            ? '1 person so far'
            : `${attestation.signatures.length} people so far`}
      </div>
    </div>
  );
}
