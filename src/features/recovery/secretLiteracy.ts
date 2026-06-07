// Sovereignty-literacy content for the secrets flow — education through use
// (teaching-system spec 2026-06-06, cut 1). Teaches the consequence of a choice
// in the moment, in plain words, from the LIVE numbers — never the mechanism,
// never jargon. The jargon-guard test keeps Shamir/threshold/descriptor off
// these strings, the same discipline secretTemplates uses.

/** Live, plain-language explanation of an M-of-N choice, in the user's terms.
 *  Teaches the availability consequence nobody intuits: more needed = safer
 *  from any one person, but more to reach, and you can lock YOURSELF out if too
 *  many are unreachable. */
export function explainThreshold(total: number, threshold: number): string {
  const slack = total - threshold;
  const slackClause =
    slack <= 0
      ? 'every one of them has to be reachable to bring it back'
      : slack === 1
        ? 'even if 1 of them is unreachable you can still bring it back'
        : `even if ${slack} of them are unreachable you can still bring it back`;
  return `You picked ${threshold} of ${total} — ${slackClause}, but you'll need to reach ${threshold}, so choose ${total} people you can actually get to.`;
}

/** The first lesson — does it hurt if someone SEES it, or only if you LOSE it? */
export const LEAK_VS_LOSS =
  'Gut check: would it be a problem if one of these people saw this — or ' +
  'would the only problem be losing it? If only losing it hurts (like the ' +
  "Wi-Fi password), you don't really need to split it; just keep it where " +
  'your people can reach it. Splitting is for secrets where someone seeing ' +
  'it would be bad.';
