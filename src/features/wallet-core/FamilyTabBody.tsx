// The Family tab is STUBBED (2026-09-03, operator: "stub the genealogy for
// now, might bring back later or make standalone that interacts with Tapit").
//
// The genealogy features — family-tree and friends-trees, ~5,000 lines and the
// heaviest product surface in the wallet after connections — are UNMOUNTED here
// and parked in the repo. Their code is untouched, their tests still run, and
// any family-tree data already saved on the device is untouched; genealogy just
// no longer ships in the running app or the bundle (this file was its only
// mount, so dropping the imports tree-shakes both features out). This
// placeholder keeps the Family tab as a breadcrumb. The bring-back path is to
// restore the real body below (git shows the prior version), or to lift
// genealogy into a standalone app that talks to a person's Tapit identity — the
// operator's stated intent. See project-memory ideas.md for the standalone note.

export function FamilyTabBody() {
  return (
    <section className="mt-5">
      <div className="rounded-2xl border border-ink/10 bg-white px-4 py-8 text-center">
        <div className="text-sm font-medium text-ink">Family tree is paused</div>
        <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-muted">
          The family tree is set aside for now while it's decided whether it
          lives inside the wallet or becomes its own app that connects to your
          Tapit identity. Nothing you've built is lost — your tree data stays on
          your device, untouched.
        </p>
      </div>
    </section>
  );
}
