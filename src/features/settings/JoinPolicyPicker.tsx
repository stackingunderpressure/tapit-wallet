import { useState } from 'react';
import type { JoinPolicy } from '../governance/authRule.ts';

// Phase 8 Phase E4 cut 3 — join-policy picker for the org-creation
// form. Sibling to OrgRulesEditor in the same SettingsScreen lazy-load
// pattern. Lives separately because the underlying AuthRule
// discriminated union splits two ways: AuthRuleForOrgAction (threshold
// + eligible) and AuthRuleForJoin (kind-tagged policy payload). The
// existing OrgRulesEditor stays focused on the org-action half so its
// threshold/eligible validation stays clean; this picker owns the
// join-policy half.
//
// Six kinds, three groups by how the org-side evaluator gates:
//   - list-checking (open / allow_list / deny_list) — evaluator works
//     purely on the joiner's pubkey
//   - proof-required (requires_handshake / requires_credential) — the
//     joiner must attach a tapit-attest DisclosureProof of an
//     attestation they hold, baked into the self-membership envelope
//     so the joiner's signature covers it
//   - cosig-required (requires_vouch) — existing members of the org
//     must cosign the self-membership envelope
//
// Validation surfaces the same errors buildAuthSubtree would throw at
// declaration time, but at form-input time so the operator never gets
// a confusing "your declaration failed" toast for a structural issue
// the form could have caught (pubkey list with bad hex, vouch count
// not a positive integer, etc.).
//
// `value === null` means "no join policy declared" — the org skips
// the `join` slot in its auth tree and verifyOpenJoinedMembership
// will fall back honestly (no open-joining channel exists, only
// org-issued memberships). `value` set to a JoinPolicy means the
// declaration commits to that policy.

const HEX_64 = /^[0-9a-f]{64}$/i;

type PolicyKind = JoinPolicy['kind'];

interface Props {
  value: JoinPolicy | null;
  onChange: (next: JoinPolicy | null) => void;
}

function parsePubkeyLines(text: string): { ok: string[]; bad: string[] } {
  const seen = new Set<string>();
  const ok: string[] = [];
  const bad: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const cleaned = raw.trim().toLowerCase();
    if (cleaned.length === 0) continue;
    if (!HEX_64.test(cleaned)) {
      bad.push(raw.trim());
      continue;
    }
    if (seen.has(cleaned)) continue;
    seen.add(cleaned);
    ok.push(cleaned);
  }
  return { ok, bad };
}

const KIND_LABEL: Record<PolicyKind, string> = {
  open: 'Open — anyone can join',
  allow_list: 'Allow list — only listed pubkeys',
  deny_list: 'Deny list — anyone except listed pubkeys',
  requires_handshake: 'Requires handshake with an anchor',
  requires_credential: 'Requires holding a credential',
  requires_vouch: 'Requires vouches from existing members',
};

const KIND_BLURB: Record<PolicyKind, string> = {
  open:
    'Any wallet may self-claim membership. Fastest to onboard; weakest abuse resistance.',
  allow_list:
    'Only the pubkeys you list may self-claim membership. Tight control; high friction to admit a new person.',
  deny_list:
    'Anyone may self-claim except the pubkeys you list. Useful for removing specific bad actors from an otherwise open join.',
  requires_handshake:
    'The joiner must already hold a co-signed handshake with at least one anchor pubkey you trust. The handshake is disclosed as proof when they join.',
  requires_credential:
    'The joiner must already hold a credential of a named type. Optionally restrict to credentials issued by a specific pubkey.',
  requires_vouch:
    'The joiner needs cosignatures from a minimum number of existing members. The vouchers cosign the join envelope itself.',
};

export function JoinPolicyPicker({ value, onChange }: Props) {
  // Local drafts for fields that aren't yet representable as a valid
  // JoinPolicy (e.g. a half-typed pubkey list, an empty number). The
  // committed JoinPolicy in `value` only changes when the draft round-
  // trips through validation. This keeps the parent's state structurally
  // clean and lets the form preserve in-progress text.
  const [pubkeyText, setPubkeyText] = useState(() =>
    value?.kind === 'allow_list' || value?.kind === 'deny_list'
      ? value.pubkeys.join('\n')
      : '',
  );
  const [handshakeText, setHandshakeText] = useState(() =>
    value?.kind === 'requires_handshake' ? value.with_any_of.join('\n') : '',
  );
  const [credType, setCredType] = useState(() =>
    value?.kind === 'requires_credential' ? value.credential_type : '',
  );
  const [credIssuer, setCredIssuer] = useState(() =>
    value?.kind === 'requires_credential' && value.issuer ? value.issuer : '',
  );
  const [vouchCount, setVouchCount] = useState(() =>
    value?.kind === 'requires_vouch'
      ? String(value.from_any_member_count)
      : '1',
  );
  const [error, setError] = useState<string | null>(null);

  const enabled = value !== null;

  function disable() {
    onChange(null);
    setError(null);
  }

  function selectKind(kind: PolicyKind) {
    setError(null);
    switch (kind) {
      case 'open':
        onChange({ kind: 'open' });
        return;
      case 'allow_list': {
        const parsed = parsePubkeyLines(pubkeyText);
        if (parsed.bad.length > 0) {
          setError(`Pubkey list has ${parsed.bad.length} invalid line(s) — each must be 64-char hex.`);
          onChange({ kind: 'allow_list', pubkeys: [] });
          return;
        }
        onChange({ kind: 'allow_list', pubkeys: parsed.ok });
        return;
      }
      case 'deny_list': {
        const parsed = parsePubkeyLines(pubkeyText);
        if (parsed.bad.length > 0) {
          setError(`Pubkey list has ${parsed.bad.length} invalid line(s) — each must be 64-char hex.`);
          onChange({ kind: 'deny_list', pubkeys: [] });
          return;
        }
        onChange({ kind: 'deny_list', pubkeys: parsed.ok });
        return;
      }
      case 'requires_handshake': {
        const parsed = parsePubkeyLines(handshakeText);
        if (parsed.ok.length < 1) {
          setError('Need at least one anchor pubkey for requires_handshake.');
          onChange({ kind: 'requires_handshake', with_any_of: [] });
          return;
        }
        if (parsed.bad.length > 0) {
          setError(`Anchor list has ${parsed.bad.length} invalid line(s) — each must be 64-char hex.`);
        }
        onChange({ kind: 'requires_handshake', with_any_of: parsed.ok });
        return;
      }
      case 'requires_credential': {
        const trimmed = credType.trim();
        if (trimmed.length === 0) {
          setError('Credential type must be non-empty.');
          onChange({ kind: 'requires_credential', credential_type: '' });
          return;
        }
        const issuerTrim = credIssuer.trim().toLowerCase();
        if (issuerTrim.length > 0 && !HEX_64.test(issuerTrim)) {
          setError('Issuer pubkey must be 64-char hex or left blank.');
          onChange({ kind: 'requires_credential', credential_type: trimmed });
          return;
        }
        onChange(
          issuerTrim
            ? { kind: 'requires_credential', credential_type: trimmed, issuer: issuerTrim }
            : { kind: 'requires_credential', credential_type: trimmed },
        );
        return;
      }
      case 'requires_vouch': {
        const n = Number(vouchCount);
        if (!Number.isInteger(n) || n < 1) {
          setError('Voucher count must be a positive integer.');
          onChange({ kind: 'requires_vouch', from_any_member_count: 1 });
          return;
        }
        onChange({ kind: 'requires_vouch', from_any_member_count: n });
        return;
      }
    }
  }

  // Re-validate whenever a kind-specific input changes, so the
  // committed JoinPolicy in `value` tracks the form as the operator
  // types. This is cheaper than a separate "save policy" button and
  // makes the declared-rule preview in SettingsScreen accurate.
  function onPubkeysChange(text: string) {
    setPubkeyText(text);
    if (value?.kind === 'allow_list' || value?.kind === 'deny_list') {
      selectKind(value.kind);
    }
  }
  function onHandshakeChange(text: string) {
    setHandshakeText(text);
    if (value?.kind === 'requires_handshake') selectKind('requires_handshake');
  }
  function onCredTypeChange(text: string) {
    setCredType(text);
    if (value?.kind === 'requires_credential') selectKind('requires_credential');
  }
  function onCredIssuerChange(text: string) {
    setCredIssuer(text);
    if (value?.kind === 'requires_credential') selectKind('requires_credential');
  }
  function onVouchChange(text: string) {
    setVouchCount(text);
    if (value?.kind === 'requires_vouch') selectKind('requires_vouch');
  }

  return (
    <div className="mt-4">
      <div className="text-sm font-medium">Join policy</div>
      <p className="mt-1 text-xs text-muted">
        Optional. Declares how an outside wallet may self-claim
        membership in this org (a "join" action in your auth tree).
        Skip this and your org accepts no open joins — only memberships
        the org itself issues.
      </p>
      {!enabled ? (
        <button
          type="button"
          onClick={() => selectKind('open')}
          className="mt-3 rounded-md border border-ink/15 px-3 py-1.5 text-xs font-medium hover:bg-ink/5"
        >
          + Declare a join policy
        </button>
      ) : (
        <div className="mt-3 rounded-md border border-ink/15 bg-white p-3">
          <label className="block text-xs">
            <span className="text-muted">Policy kind</span>
            <select
              value={value.kind}
              onChange={(e) => selectKind(e.target.value as PolicyKind)}
              className="mt-1 w-full rounded-md border border-ink/15 bg-white px-2 py-1.5 text-sm"
            >
              {(Object.keys(KIND_LABEL) as PolicyKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-2 text-[11px] text-muted">{KIND_BLURB[value.kind]}</p>

          {(value.kind === 'allow_list' || value.kind === 'deny_list') && (
            <label className="mt-3 block text-xs">
              <span className="text-muted">
                {value.kind === 'allow_list' ? 'Allowed' : 'Denied'} pubkeys — one hex per line
              </span>
              <textarea
                value={pubkeyText}
                onChange={(e) => onPubkeysChange(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-md border border-ink/15 bg-white px-2 py-1.5 text-xs font-mono"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </label>
          )}

          {value.kind === 'requires_handshake' && (
            <label className="mt-3 block text-xs">
              <span className="text-muted">
                Anchor pubkeys — joiner must hold a handshake with at least one of these
              </span>
              <textarea
                value={handshakeText}
                onChange={(e) => onHandshakeChange(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-md border border-ink/15 bg-white px-2 py-1.5 text-xs font-mono"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </label>
          )}

          {value.kind === 'requires_credential' && (
            <>
              <label className="mt-3 block text-xs">
                <span className="text-muted">Credential type (e.g. "voter", "verified_human")</span>
                <input
                  type="text"
                  value={credType}
                  onChange={(e) => onCredTypeChange(e.target.value)}
                  placeholder="voter"
                  className="mt-1 w-full rounded-md border border-ink/15 bg-white px-2 py-1.5 text-sm"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </label>
              <label className="mt-2 block text-xs">
                <span className="text-muted">
                  Issuer pubkey (optional) — restrict to credentials signed by this issuer
                </span>
                <input
                  type="text"
                  value={credIssuer}
                  onChange={(e) => onCredIssuerChange(e.target.value)}
                  placeholder="(any issuer)"
                  className="mt-1 w-full rounded-md border border-ink/15 bg-white px-2 py-1.5 text-xs font-mono"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </label>
            </>
          )}

          {value.kind === 'requires_vouch' && (
            <label className="mt-3 block text-xs">
              <span className="text-muted">Cosignatures required from existing members</span>
              <input
                type="number"
                min={1}
                value={vouchCount}
                onChange={(e) => onVouchChange(e.target.value)}
                className="mt-1 w-24 rounded-md border border-ink/15 bg-white px-2 py-1.5 text-sm"
              />
            </label>
          )}

          {error && (
            <p className="mt-2 text-xs text-red-600" role="alert">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={disable}
            className="mt-3 text-xs text-red-600 hover:underline"
          >
            Remove join policy
          </button>
        </div>
      )}
    </div>
  );
}
