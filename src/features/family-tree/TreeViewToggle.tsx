// Family-tree — the "Tree | Explore" segmented toggle that swaps the canvas
// between the connected overview (FamilyTreeCanvas) and the focus-and-walk
// navigator (FamilyTreeExplorer). Extracted from FamilyTreeEditor purely to
// keep that file under the 800-line doctrine; it is a dumb controlled toggle.

export type TreeView = 'tree' | 'explore';

const OPTIONS: { value: TreeView; label: string }[] = [
  { value: 'tree', label: '🌳 Tree' },
  { value: 'explore', label: '🚶 Explore' },
];

export function TreeViewToggle({
  value,
  onChange,
}: {
  value: TreeView;
  onChange: (v: TreeView) => void;
}) {
  return (
    <div className="mt-4 flex justify-center gap-1 rounded-lg border border-ink/10 bg-ink/[0.03] p-0.5">
      {OPTIONS.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition active:animate-fresh-press motion-reduce:active:animate-none ${
              active ? 'bg-paper text-ink shadow-sm' : 'text-muted hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
