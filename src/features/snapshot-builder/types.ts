// Frank chassis — snapshot-builder pattern.
//
// Promoted from Hal (Wealth Strategy). Every onboarding bot needs a
// single source-of-truth function that builds a flat-text snapshot
// of the user's current state — balance sheet for Hal, pastoral
// context for Andrew, appointment book for Ella, station status for
// Maitre — and a renderer that turns that snapshot into the volatile
// system-message block.
//
// The pattern is universal because the failure mode it prevents is
// universal: when the bot's understanding of "right now" comes from
// scraping the same state from three different services, those
// services drift apart and the bot starts saying things like "your
// signal score is 47" while the dashboard reads 52. Hal solved this
// by routing every turn's snapshot through ONE function. The chassis
// codifies the shape so every spawn does the same.
//
// ──────────────────────────────────────────────────────────────────
// THE CONTRACT
// ──────────────────────────────────────────────────────────────────
//
// A spawn implements two things:
//
//   1. A `buildSnapshot()` function that pulls the tenant's + the
//      customer's CURRENT state from whatever services own that
//      state (Supabase, browser cache, in-flight composer state)
//      and returns a typed `Snapshot` object.
//
//   2. A `renderSnapshot()` function that takes the typed Snapshot
//      and returns a flat string organized into section headers,
//      ready to be the `system_volatile` block in BotRuntimeConfig.
//
// The Snapshot type is spawn-specific (Hal's has signal scores +
// debt verdicts + retirement accounts; Andrew's has flock + sermon
// state + memory queue). The chassis only defines the SHAPE of the
// snapshot-builder pattern — a registry of section-builders that
// each contribute a piece, composed in deterministic order.
//
// ──────────────────────────────────────────────────────────────────
// DETERMINISTIC ORDER MATTERS
// ──────────────────────────────────────────────────────────────────
//
// The volatile block goes into the prompt right after the cached
// stable block. If the section order shuffles between turns, the
// model can't form a stable reference frame and responses get
// inconsistent. Always order sections the same way; if you need to
// hide a section (no debts → no debt section), OMIT it rather than
// outputting an empty header.

/**
 * A single section of the snapshot. Each section contributes a
 * header + body string. Sections may opt out (return null) when
 * empty so the rendered output stays clean.
 */
export interface SnapshotSection {
  /** Stable id for the section. Used for ordering + testing. */
  id: string;
  /** Plain-English header (e.g. "Balance sheet", "Active flock"). */
  header: string;
  /**
   * Build the section body. Return null to omit the section entirely
   * (preferred when the section has no data).
   */
  build: () => Promise<string | null> | string | null;
}

/**
 * Run all sections in order and assemble the volatile system block.
 * Sections that return null are silently omitted. Each section is
 * rendered as:
 *
 *     ## <header>
 *     <body>
 *
 * Separated by a blank line. The returned string is suitable as
 * `system_volatile` in BotRuntimeConfig.
 */
export async function renderSnapshot(
  sections: SnapshotSection[],
): Promise<string> {
  const out: string[] = [];
  for (const section of sections) {
    const body = await section.build();
    if (body === null || body === undefined) continue;
    const trimmed = body.trim();
    if (trimmed.length === 0) continue;
    out.push(`## ${section.header}`);
    out.push(trimmed);
    out.push("");
  }
  return out.join("\n").trimEnd();
}

/**
 * Helper for spawns: build a section that just renders a key/value
 * map as "key: value" lines. Common shape for balance-sheet,
 * cash-flow, etc.
 */
export function kvSection(
  id: string,
  header: string,
  data: Record<string, string | number | boolean | null | undefined>,
): SnapshotSection {
  return {
    id,
    header,
    build() {
      const lines: string[] = [];
      for (const [key, value] of Object.entries(data)) {
        if (value === null || value === undefined) continue;
        lines.push(`${key}: ${value}`);
      }
      return lines.length > 0 ? lines.join("\n") : null;
    },
  };
}

/**
 * Helper for spawns: build a section from a list of records, each
 * rendered as a bullet line. Common shape for recent-activity feeds
 * (Hal's "ten most recent BTC buys", Andrew's "last three sermons").
 */
export function listSection<T>(
  id: string,
  header: string,
  records: T[],
  renderOne: (record: T) => string,
): SnapshotSection {
  return {
    id,
    header,
    build() {
      if (records.length === 0) return null;
      return records.map((r) => `- ${renderOne(r)}`).join("\n");
    },
  };
}
