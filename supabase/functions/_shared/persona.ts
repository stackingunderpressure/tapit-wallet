// Frank chassis — Deno-side persona module (v2).
//
// PFOR-027 contract: this file is paired with src/features/persona/types.ts
// (frontend mirror). The two MUST stay byte-identical in type shape and
// render output. The paired vitest contract test at
// src/shared/persona-contract.test.ts asserts parity on every spawn's
// `npm test` gate.
//
// v2 expansion (2026-05-14, chassis harvest pass): added `doctrine`,
// `anecdotes`, and `identity_blend` fields. Promoted from Andrew
// (Shepherd's Desk) which encodes hard prohibitions + tradition
// doctrine in his system prompt, and from Hal (Wealth Strategy)
// which blends Hal Finney + Satoshi Nakamoto as a single voice with
// attribution rules. Both proved the shape in production; the
// chassis v2 lifts it.
//
// Each spawned app inherits this file unchanged. Spawns customize
// the bot voice by providing a PersonaProfile in the tenant's
// record; this module only owns the SHAPE and the RENDER.

export type Tone = "warm" | "professional" | "playful" | "direct" | "calming";

export type Pace = "slow" | "balanced" | "energetic";

/**
 * Identity blend — when a bot's voice is composed of two
 * inspirations (Hal Finney + Satoshi for Hal; could be two
 * historical pastors for Andrew, two coaches for a wellness bot,
 * etc.) the chassis encodes the blend explicitly so the model can
 * reach for the right tone per moment without claiming to BE the
 * historical figure.
 */
export interface IdentityBlend {
  /** Primary inspiration's name (the public-facing voice). */
  primary: string;
  /** What the primary inspiration contributes. */
  primary_brings: string;
  /** Secondary inspiration's name. */
  secondary: string;
  /** What the secondary inspiration contributes. */
  secondary_brings: string;
  /**
   * Hard attribution rules — what the bot must NEVER do regarding
   * the historical figures (e.g. "never claim to be Satoshi", "never
   * speak as if Hal Finney is alive today").
   */
  attribution_rules: string[];
}

/**
 * A single anecdote the bot can reach for naturally. Andrew's
 * pastoral memory + Hal's cypherpunk history both surfaced this
 * pattern. The bot doesn't recite anecdotes verbatim; the prompt
 * lists them as "things you may reference if relevant" so the model
 * can pull them in at the right moment.
 */
export interface PersonaAnecdote {
  /** Stable id. */
  id: string;
  /** When the bot may reach for this (cue tags). */
  cue_tags: string[];
  /** The anecdote text in plain prose. */
  text: string;
}

export interface PersonaProfile {
  /** Display name the bot uses for itself ("Ella", "Maitre", ...). */
  name: string;
  /** Vertical-flavored role description (e.g. "salon concierge"). */
  role: string;
  /** Long-form mission paragraph the bot keeps in mind. */
  mission: string;
  /** Short list of values the bot honors. */
  values: string[];
  /** Conversational tone. */
  tone: Tone;
  /** Reply pace. */
  pace: Pace;
  /** Phrases the bot prefers to use. */
  signature_phrases: string[];
  /** Phrases the bot avoids. */
  forbidden_phrases: string[];
  /** Operator-pinned corrections accumulated over time. */
  corrections: string[];
  /**
   * v2: doctrine — short list of disciplinary principles the bot
   * encodes as identity-shaping commitments. Hal's five points
   * (fixed supply, cryptographic proof, technology for the
   * individual, time as the asset's secret, liquidity trap) and
   * Andrew's hard prohibitions both live here.
   */
  doctrine: string[];
  /**
   * v2: shared-memory anecdotes the bot may reach for. Empty array
   * is fine for plain bots.
   */
  anecdotes: PersonaAnecdote[];
  /**
   * v2: identity blend. Optional — set when the bot's voice
   * deliberately combines two inspirations.
   */
  identity_blend?: IdentityBlend;
}

export const DEFAULT_PERSONA: PersonaProfile = {
  name: "Assistant",
  role: "tenant concierge",
  mission:
    "Help the tenant's customers feel heard, served, and supported. Move conversations toward a useful next step without rushing the person.",
  values: [
    "the customer's time matters",
    "honesty over flattery",
    "small details remembered",
    "no pressure, no manipulation",
  ],
  tone: "warm",
  pace: "balanced",
  signature_phrases: [],
  forbidden_phrases: [],
  corrections: [],
  doctrine: [],
  anecdotes: [],
};

/**
 * Render the persona into a system-prompt block. Byte-identical with
 * the frontend mirror — DO NOT change one without changing both.
 *
 * Section order is fixed (identity → doctrine → mission → values →
 * tone → blend → phrases → anecdotes → corrections) so the cache
 * prefix stays consistent across turns.
 *
 * @param persona  the tenant's persona profile
 * @param providerName  business display name (the tenant's name)
 */
export function renderPersonaSystemPrompt(
  persona: PersonaProfile,
  providerName: string,
): string {
  const lines: string[] = [];
  lines.push(`You are ${persona.name}, ${providerName}'s ${persona.role}.`);
  lines.push("");
  if (persona.identity_blend) {
    const blend = persona.identity_blend;
    lines.push(
      `Your voice blends ${blend.primary} and ${blend.secondary}.`,
    );
    lines.push(`${blend.primary} brings ${blend.primary_brings}.`);
    lines.push(`${blend.secondary} brings ${blend.secondary_brings}.`);
    if (blend.attribution_rules.length > 0) {
      lines.push("Attribution rules (apply every time):");
      for (const rule of blend.attribution_rules) {
        lines.push(`- ${rule}`);
      }
    }
    lines.push("");
  }
  if (persona.doctrine.length > 0) {
    lines.push("Doctrine — the disciplinary principles you honor:");
    for (const principle of persona.doctrine) {
      lines.push(`- ${principle}`);
    }
    lines.push("");
  }
  lines.push("Mission:");
  lines.push(persona.mission);
  lines.push("");
  if (persona.values.length > 0) {
    lines.push("Values you honor:");
    for (const value of persona.values) {
      lines.push(`- ${value}`);
    }
    lines.push("");
  }
  lines.push(`Tone: ${persona.tone}.`);
  lines.push(`Pace: ${persona.pace}.`);
  lines.push("");
  if (persona.signature_phrases.length > 0) {
    lines.push("Phrases you naturally reach for:");
    for (const phrase of persona.signature_phrases) {
      lines.push(`- ${phrase}`);
    }
    lines.push("");
  }
  if (persona.forbidden_phrases.length > 0) {
    lines.push("Phrases you never use:");
    for (const phrase of persona.forbidden_phrases) {
      lines.push(`- ${phrase}`);
    }
    lines.push("");
  }
  if (persona.anecdotes.length > 0) {
    lines.push(
      "Shared memory — anecdotes you may reference when the moment fits:",
    );
    for (const anecdote of persona.anecdotes) {
      const cues =
        anecdote.cue_tags.length > 0
          ? ` [${anecdote.cue_tags.join(", ")}]`
          : "";
      lines.push(`- ${anecdote.text}${cues}`);
    }
    lines.push("");
  }
  if (persona.corrections.length > 0) {
    lines.push("Operator corrections (apply every time):");
    for (const correction of persona.corrections) {
      lines.push(`- ${correction}`);
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

/**
 * Apply an operator correction. Idempotent — re-applying the same
 * correction does not duplicate. Returns a NEW PersonaProfile, never
 * mutates the input.
 */
export function applyCorrection(
  persona: PersonaProfile,
  correction: string,
): PersonaProfile {
  const trimmed = correction.trim();
  if (trimmed.length === 0) return persona;
  if (persona.corrections.includes(trimmed)) return persona;
  return {
    ...persona,
    corrections: [...persona.corrections, trimmed],
  };
}

/**
 * Add a doctrine principle. Idempotent. v2 helper.
 */
export function addDoctrinePrinciple(
  persona: PersonaProfile,
  principle: string,
): PersonaProfile {
  const trimmed = principle.trim();
  if (trimmed.length === 0) return persona;
  if (persona.doctrine.includes(trimmed)) return persona;
  return {
    ...persona,
    doctrine: [...persona.doctrine, trimmed],
  };
}

/**
 * Add a shared-memory anecdote. Idempotent on `id`. v2 helper.
 */
export function addAnecdote(
  persona: PersonaProfile,
  anecdote: PersonaAnecdote,
): PersonaProfile {
  if (persona.anecdotes.some((a) => a.id === anecdote.id)) return persona;
  return {
    ...persona,
    anecdotes: [...persona.anecdotes, anecdote],
  };
}
