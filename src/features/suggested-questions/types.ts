// Frank chassis — suggested-questions pattern.
//
// Promoted from Hal (Wealth Strategy). Hal's panel surfaces
// contextual suggested-question chips at the start of every
// conversation: if your signal score is below thirty-five you see
// an accumulation question, if you have high-rate debt you see a
// payoff question. Andrew's onboarding sheet shows the equivalent
// for pastors. Every onboarding bot needs the same shape — chips
// that match the user's CURRENT state and lower the activation
// energy for a first reply.
//
// Without contextual chips, the user opens chat and stares at a
// blank field. With them, the user taps the chip that matches the
// thing they were already wondering about and the conversation has
// a useful first turn for free.
//
// ──────────────────────────────────────────────────────────────────
// THE CONTRACT
// ──────────────────────────────────────────────────────────────────
//
// A spawn defines a list of `SuggestedQuestion` candidates, each
// with a `when(state)` predicate that takes the user's current state
// snapshot and returns true if the chip should surface. The
// `pickSuggestedQuestions` helper runs every candidate and returns
// the first N matches (Hal uses 3) in declaration order.
//
// Predicates should be PURE and cheap — the chip list re-evaluates
// on every state change. No API calls inside `when()`.

export interface SuggestedQuestion<TState = unknown> {
  /** Stable id for analytics + dedupe. */
  id: string;
  /** The text rendered on the chip the user taps. */
  prompt: string;
  /**
   * Predicate against the user's current state snapshot. Returns true
   * when this chip should appear. Pure + cheap.
   */
  when: (state: TState) => boolean;
  /**
   * Optional priority — higher priority chips bubble to the front of
   * the rendered list. Defaults to 0.
   */
  priority?: number;
  /**
   * Optional category tag for analytics ("accumulation", "debt",
   * "intake", "scheduling", etc.).
   */
  category?: string;
}

/**
 * Pick the top N matching chips for the current state. Returns chips
 * in priority order (highest first); ties broken by declaration
 * order.
 */
export function pickSuggestedQuestions<TState>(
  candidates: SuggestedQuestion<TState>[],
  state: TState,
  max: number = 3,
): SuggestedQuestion<TState>[] {
  const matches = candidates.filter((c) => {
    try {
      return c.when(state);
    } catch {
      return false;
    }
  });
  matches.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  return matches.slice(0, Math.max(0, max));
}

/**
 * Catalog wrapper — spawns export a single SuggestedQuestionCatalog
 * from their feature folder; the panel imports + calls
 * pickSuggestedQuestions against it.
 */
export interface SuggestedQuestionCatalog<TState = unknown> {
  /** Catalog name for logging + the drift audit. */
  name: string;
  /** Catalog version (semver). Bump on content change. */
  version: string;
  /** The candidate chips. */
  candidates: SuggestedQuestion<TState>[];
}
