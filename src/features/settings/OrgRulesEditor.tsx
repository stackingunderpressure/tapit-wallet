import { useState } from 'react';
import type { AuthRule } from '../governance/authRule.ts';

// Phase 8 Phase C cut 2 — multi-rule org creation UI. Renders the
// current list of authorization rules, with the default
// routine_issuance rule displayed as a non-deletable card so the
// operator can see what they are signing even if they add nothing
// else. The "Add rule" button expands an inline mini-form that
// collects an action name, additional eligible signer pubkeys (the
// founder is always implicitly in eligible — they can override that
// at signing-time by editing the textarea), and a threshold.
//
// Validation surfaces the same errors buildAuthSubtree would throw
// at declaration time (duplicate action, threshold < 1,
// threshold > eligible count), but at form-input time so the
// operator never gets a confusing "your declaration failed" toast
// for a structural issue the form could have caught.
//
// Eligible signers are taken as one hex pubkey per line in a
// textarea. A peer-roster multi-picker is the natural polish for a
// future cut — for this cut, paste-or-type is the floor that ships.

const HEX_64 = /^[0-9a-f]{64}$/i;

interface Props {
  /** The org's own identity hex (always pre-populated as an eligible signer for a new rule). */
  founder: string;
  /** Current rules list; the parent owns this state. */
  value: readonly AuthRule[];
  onChange: (next: AuthRule[]) => void;
}

interface DraftRule {
  action: string;
  /** Newline-separated hex pubkeys. */
  eligibleText: string;
  /** Threshold as a string so an empty input renders. */
  thresholdText: string;
}

function emptyDraft(founder: string): DraftRule {
  return {
    action: '',
    eligibleText: founder,
    thresholdText: '1',
  };
}

function shortKey(hex: string): string {
  if (hex.length <= 12) return hex;
  return `${hex.slice(0, 8)}…${hex.slice(-4)}`;
}

function parseEligible(text: string): { ok: string[]; bad: string[] } {
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

function validateDraft(
  draft: DraftRule,
  existingActions: readonly string[],
): { rule: AuthRule | null; error: string | null } {
  const action = draft.action.trim();
  if (action.length === 0) return { rule: null, error: 'Action name required.' };
  if (!/^[a-z0-9_]+$/.test(action)) {
    return {
      rule: null,
      error: 'Action name must be lowercase letters, digits, or underscore.',
    };
  }
  if (existingActions.includes(action)) {
    return { rule: null, error: `Action '${action}' is already declared.` };
  }
  const parsed = parseEligible(draft.eligibleText);
  if (parsed.bad.length > 0) {
    return {
      rule: null,
      error: `Eligible list has ${parsed.bad.length} invalid line(s) — each must be 64-char hex.`,
    };
  }
  if (parsed.ok.length === 0) {
    return { rule: null, error: 'At least one eligible signer pubkey required.' };
  }
  const threshold = Number(draft.thresholdText);
  if (!Number.isInteger(threshold) || threshold < 1) {
    return { rule: null, error: 'Threshold must be a positive integer.' };
  }
  if (threshold > parsed.ok.length) {
    return {
      rule: null,
      error: `Threshold ${threshold} exceeds eligible count ${parsed.ok.length}.`,
    };
  }
  return {
    rule: { action, threshold, eligible: parsed.ok },
    error: null,
  };
}

export function OrgRulesEditor({ founder, value, onChange }: Props) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<DraftRule>(() => emptyDraft(founder));
  const [draftError, setDraftError] = useState<string | null>(null);

  const existingActions = value.map((r) => r.action);

  function addRule() {
    const { rule, error } = validateDraft(draft, existingActions);
    if (!rule) {
      setDraftError(error);
      return;
    }
    onChange([...value, rule]);
    setDraft(emptyDraft(founder));
    setDraftError(null);
    setAdding(false);
  }

  function removeRule(action: string) {
    onChange(value.filter((r) => r.action !== action));
  }

  return (
    <div className="mt-4">
      <div className="text-sm font-medium">Governance rules</div>
      <p className="mt-1 text-xs text-muted">
        Each rule names an action and how many signers from a named
        eligible set are required to authorize it. The default below is
        "you alone authorize every action" — add more rules to delegate
        specific actions to multi-signer subsets.
      </p>
      <ul className="mt-2 space-y-2">
        {value.map((rule, idx) => {
          const isDefault =
            idx === 0 &&
            rule.action === 'routine_issuance' &&
            rule.eligible.length === 1 &&
            rule.eligible[0]?.toLowerCase() === founder.toLowerCase();
          return (
            <li
              key={rule.action}
              className="rounded-md border border-ink/15 bg-ink/5 px-3 py-2 text-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-sm">{rule.action}</div>
                  <div className="text-muted">
                    {rule.threshold} of {rule.eligible.length} signature
                    {rule.eligible.length === 1 ? '' : 's'} required
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-muted">
                    Eligible:{' '}
                    {rule.eligible.map((e) => shortKey(e)).join(', ')}
                  </div>
                </div>
                {!isDefault && (
                  <button
                    type="button"
                    onClick={() => removeRule(rule.action)}
                    className="shrink-0 text-xs text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
              {isDefault && (
                <div className="mt-1 text-[10px] uppercase tracking-wide text-muted">
                  Default rule — kept to preserve founder-signs-everything behaviour
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {adding ? (
        <div className="mt-3 rounded-md border border-ink/15 bg-white p-3">
          <label className="block text-xs">
            <span className="text-muted">Action name</span>
            <input
              type="text"
              value={draft.action}
              onChange={(e) =>
                setDraft((d) => ({ ...d, action: e.target.value }))
              }
              placeholder="expulsion"
              className="mt-1 w-full rounded-md border border-ink/15 bg-white px-2 py-1.5 text-sm"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>
          <label className="mt-2 block text-xs">
            <span className="text-muted">Eligible signers — one hex pubkey per line</span>
            <textarea
              value={draft.eligibleText}
              onChange={(e) =>
                setDraft((d) => ({ ...d, eligibleText: e.target.value }))
              }
              rows={4}
              className="mt-1 w-full rounded-md border border-ink/15 bg-white px-2 py-1.5 text-xs font-mono"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            <span className="mt-1 block text-[10px] text-muted">
              Your own pubkey is pre-filled. Add other signers by pasting
              their 64-character hex public keys, one per line.
            </span>
          </label>
          <label className="mt-2 block text-xs">
            <span className="text-muted">Threshold (signatures required)</span>
            <input
              type="number"
              min={1}
              value={draft.thresholdText}
              onChange={(e) =>
                setDraft((d) => ({ ...d, thresholdText: e.target.value }))
              }
              className="mt-1 w-24 rounded-md border border-ink/15 bg-white px-2 py-1.5 text-sm"
            />
          </label>
          {draftError && (
            <p className="mt-2 text-xs text-red-600" role="alert">
              {draftError}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={addRule}
              className="rounded-md bg-ink px-3 py-1.5 text-paper text-xs font-medium"
            >
              Add rule
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setDraft(emptyDraft(founder));
                setDraftError(null);
              }}
              className="rounded-md border border-ink/15 px-3 py-1.5 text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-3 rounded-md border border-ink/15 px-3 py-1.5 text-xs font-medium hover:bg-ink/5"
        >
          + Add rule
        </button>
      )}
    </div>
  );
}
