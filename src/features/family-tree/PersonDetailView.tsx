import { type ReactNode } from 'react';
import type { Attestation, FieldBranch } from 'tapit-attest';
import type { KinNode } from './kinGraph.ts';
import type { Sex } from './personNode.ts';
import { type AppliedEdit, type FoldResult } from './personEdit.ts';
import { KinAvatar } from './KinAvatar.tsx';
import { genderKinLabel } from './gender.ts';
import { explainRelationship } from './kinEducation.ts';
import { readEventDate, formatEventDate } from '../journal/momentDate.ts';

// Family-tree — the PERSON DETAIL view (split out of FamilyTreeEditor to keep
// each file under the 800-line hard limit). Presentational: every piece of
// state and every action is handed in by the editor, which still owns the
// wallet, the graph, and the persistence. This panel shows who a person is,
// lets you sign an append-only correction to their details (or remove them),
// shows the full history of signed changes with the co-signature verdict,
// lists the moments you've kept about them, and lets you grow the tree from
// them via the shared add-relative form.

function claimString(att: Attestation, name: string): string {
  const claim = att.claim as FieldBranch;
  const node = claim.children.find((c) => c.name === name);
  return node && node.node === 'leaf' && typeof node.value === 'string'
    ? node.value
    : '';
}

interface Props {
  person: KinNode;
  relationship: string;
  embedded: boolean;
  onBack: () => void;
  onClose?: () => void;
  stories: Attestation[];
  changes: FoldResult | null;
  editing: boolean;
  editName: string;
  setEditName: (v: string) => void;
  editBorn: string;
  setEditBorn: (v: string) => void;
  editDied: string;
  setEditDied: (v: string) => void;
  editSex: Sex | undefined;
  setEditSex: (v: Sex | undefined) => void;
  editBusy: boolean;
  editError: string | null;
  confirmRemove: boolean;
  setConfirmRemove: (v: boolean) => void;
  onOpenEdit: () => void;
  onApplyEdit: () => void;
  onRemove: () => void;
  onCancelEdit: () => void;
  signerLabel: (signer: string) => string;
  momentText: string;
  setMomentText: (v: string) => void;
  momentDate: string;
  setMomentDate: (v: string) => void;
  momentBusy: boolean;
  momentError: string | null;
  onAddMoment: () => void;
  renderAddForm: (opts: {
    onAdd: () => void;
    canSibling: boolean;
    relationLabel: string;
    submitLabel: string;
  }) => ReactNode;
  onAddRelative: () => void;
  canSibling: boolean;
}

export function PersonDetailView({
  person,
  relationship,
  embedded,
  onBack,
  onClose,
  stories,
  changes,
  editing,
  editName,
  setEditName,
  editBorn,
  setEditBorn,
  editDied,
  setEditDied,
  editSex,
  setEditSex,
  editBusy,
  editError,
  confirmRemove,
  setConfirmRemove,
  onOpenEdit,
  onApplyEdit,
  onRemove,
  onCancelEdit,
  signerLabel,
  momentText,
  setMomentText,
  momentDate,
  setMomentDate,
  momentBusy,
  momentError,
  onAddMoment,
  renderAddForm,
  onAddRelative,
  canSibling,
}: Props) {
  return (
    <>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-muted hover:text-ink"
        >
          ← Tree
        </button>
        {!embedded && (
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-muted hover:text-ink"
          >
            Done
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-col items-center text-center animate-fresh-rise motion-reduce:animate-none">
        <KinAvatar node={person} size={64} />
        <h2 className="mt-2 text-xl font-semibold">{person.displayName}</h2>
        <span className="mt-1 rounded-full bg-accent/10 px-3 py-0.5 text-sm font-medium text-accent">
          {genderKinLabel(relationship, person.sex)}
        </span>
        <div className="mt-1 text-xs text-muted">
          {person.born || person.died ? (
            <span>
              {person.born ?? '?'}
              {person.died ? `–${person.died}` : ''}
            </span>
          ) : null}
          {!person.keyed && (
            <span className={person.born || person.died ? 'ml-1' : ''}>
              · remembered by you
            </span>
          )}
        </div>
        {relationship !== 'you' && (
          <p className="mt-2 max-w-xs rounded-lg bg-ink/[0.03] px-3 py-2 text-xs text-muted">
            <span aria-hidden>📖 </span>
            {explainRelationship(relationship)}
          </p>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-ink/10 bg-white p-3">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Details
          </div>
          {!editing && (
            <button
              type="button"
              onClick={onOpenEdit}
              className="text-xs font-medium text-accent hover:underline"
            >
              ✏️ Edit
            </button>
          )}
        </div>

        {changes?.requiresCosign && (
          <p className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
            🔒 {person.displayName} is co-signed by{' '}
            {changes.controllingSigners.length} family members. Changes now need
            everyone's signature — your edit is saved as a proposal and takes
            effect once the others co-sign.
          </p>
        )}

        {editing ? (
          <div className="mt-2 space-y-2">
            <div>
              <label className="text-xs text-muted" htmlFor="ft-edit-name">
                Name
              </label>
              <input
                id="ft-edit-name"
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-base focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-muted" htmlFor="ft-edit-born">
                  Born
                </label>
                <input
                  id="ft-edit-born"
                  type="date"
                  value={editBorn}
                  onChange={(e) => setEditBorn(e.target.value)}
                  className="mt-1 w-full rounded-md border border-ink/15 bg-white px-2 py-1.5 text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted" htmlFor="ft-edit-died">
                  Died
                </label>
                <input
                  id="ft-edit-died"
                  type="date"
                  value={editDied}
                  onChange={(e) => setEditDied(e.target.value)}
                  className="mt-1 w-full rounded-md border border-ink/15 bg-white px-2 py-1.5 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(['female', 'male'] as const).map((s) => {
                const active = editSex === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setEditSex(active ? undefined : s)}
                    aria-pressed={active}
                    className={`rounded-lg border px-2 py-1.5 text-sm font-medium transition ${
                      active
                        ? 'border-ink bg-ink text-paper'
                        : 'border-ink/15 bg-white text-ink hover:bg-ink/[0.04]'
                    }`}
                  >
                    <span aria-hidden className="mr-1">
                      {s === 'female' ? '♀' : '♂'}
                    </span>
                    {s === 'female' ? 'Female' : 'Male'}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onApplyEdit}
                disabled={editBusy}
                className="flex-1 rounded-md bg-ink py-2 text-sm font-medium text-paper transition active:animate-fresh-press motion-reduce:active:animate-none disabled:opacity-40"
              >
                {editBusy ? 'Signing…' : '🖊 Sign change'}
              </button>
              <button
                type="button"
                onClick={onCancelEdit}
                disabled={editBusy}
                className="rounded-md border border-ink/15 px-3 py-2 text-sm text-muted hover:bg-ink/5"
              >
                Cancel
              </button>
            </div>
            {relationship !== 'you' &&
              (confirmRemove ? (
                <div className="flex items-center justify-between rounded-md bg-red-50 px-2 py-1.5">
                  <span className="text-[11px] text-red-700">
                    Remove {person.displayName} from your tree?
                  </span>
                  <span className="flex gap-2">
                    <button
                      type="button"
                      onClick={onRemove}
                      disabled={editBusy}
                      className="text-xs font-semibold text-red-700 hover:underline"
                    >
                      Remove
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRemove(false)}
                      className="text-xs text-muted hover:underline"
                    >
                      Keep
                    </button>
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmRemove(true)}
                  className="text-[11px] text-red-600 hover:underline"
                >
                  Remove this person
                </button>
              ))}
            {editError && (
              <p className="text-xs text-red-600" role="alert">
                {editError}
              </p>
            )}
          </div>
        ) : (
          changes &&
          changes.history.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {[...changes.history].reverse().map((h: AppliedEdit) => (
                <li
                  key={h.id}
                  className="flex items-center justify-between text-[11px] text-muted"
                >
                  <span className="truncate">
                    {h.state.removed
                      ? 'Removed'
                      : `Renamed to "${h.state.displayName}"`}{' '}
                    · {signerLabel(h.signers[0] ?? '')} ·{' '}
                    {new Date(h.issuedAt).toLocaleDateString()}
                  </span>
                  <span
                    className={`ml-2 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] ${
                      h.applied
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {h.applied ? 'signed' : 'pending'}
                  </span>
                </li>
              ))}
            </ul>
          )
        )}
      </div>

      <div className="mt-4">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
          Moments about {person.displayName}
        </div>
        {stories.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            No moments yet. Add the first one below — a story, something they
            did, how they made you feel.
          </p>
        ) : (
          <ul className="mt-2 space-y-3">
            {stories.map((s) => {
              const ev = readEventDate(s);
              const when = ev
                ? formatEventDate(ev)
                : new Date(
                    claimString(s, 'written_at') || s.issuedAt,
                  ).toLocaleDateString();
              const title = claimString(s, 'title');
              const text = claimString(s, 'text');
              return (
                <li
                  key={s.subject + (claimString(s, 'written_at') || s.issuedAt)}
                  className="rounded-lg border border-ink/10 bg-white p-3"
                >
                  <div className="text-xs font-medium text-ink">{when}</div>
                  {title && (
                    <div className="mt-0.5 text-sm font-semibold">{title}</div>
                  )}
                  {text && (
                    <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-sm">
                      {text}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-4 rounded-lg border border-ink/10 bg-white p-3">
          <label className="text-xs font-medium" htmlFor="ft-moment-text">
            Add a moment about {person.displayName}
          </label>
          <textarea
            id="ft-moment-text"
            rows={3}
            value={momentText}
            onChange={(e) => setMomentText(e.target.value)}
            placeholder="A story, something they did, how they made you feel…"
            className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <div className="mt-2 flex items-center gap-2">
            <input
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              value={momentDate}
              onChange={(e) => setMomentDate(e.target.value)}
              className="flex-1 rounded-md border border-ink/15 bg-white px-2 py-1.5 text-sm"
              aria-label="When did this happen (optional)"
            />
            <button
              type="button"
              onClick={onAddMoment}
              disabled={momentBusy}
              className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper transition active:animate-fresh-press motion-reduce:active:animate-none disabled:opacity-40"
            >
              {momentBusy ? 'Signing…' : 'Sign moment'}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-muted">
            Optional date — leave empty if it happened today; set a past date to
            record an older memory.
          </p>
          {momentError && (
            <p className="mt-1 text-xs text-red-600" role="alert">
              {momentError}
            </p>
          )}
        </div>
      </div>

      <div className="mt-5 border-t border-ink/10 pt-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
          Grow the tree from {person.displayName}
        </div>
        <p className="mt-1 text-xs text-muted">
          Add their parents, kids, spouse, or a sibling — this is how
          grandparents, great-uncles, and cousins come into your tree.
        </p>
        {renderAddForm({
          onAdd: onAddRelative,
          canSibling,
          relationLabel: `Their relation to ${person.displayName}`,
          submitLabel: '🌿 Add a relative',
        })}
      </div>
    </>
  );
}
