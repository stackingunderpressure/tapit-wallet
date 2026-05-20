// Frank chassis — frontend persona mirror (v2).
//
// PFOR-027 contract: this file MUST stay byte-identical in type
// shape and render output with the Deno-side at
// supabase/functions/_shared/persona.ts. The paired vitest contract
// test at src/shared/persona-contract.test.ts asserts parity on
// every spawn's `npm test` gate.
//
// If you change one, change both AND re-run the contract test.
//
// v2 expansion (2026-05-14, chassis harvest pass): added `doctrine`,
// `anecdotes`, and `identity_blend` fields. See Deno-side persona.ts
// for promotion lineage (Andrew + Hal).

export type Tone = "warm" | "professional" | "playful" | "direct" | "calming";

export type Pace = "slow" | "balanced" | "energetic";

export interface IdentityBlend {
  primary: string;
  primary_brings: string;
  secondary: string;
  secondary_brings: string;
  attribution_rules: string[];
}

export interface PersonaAnecdote {
  id: string;
  cue_tags: string[];
  text: string;
}

export interface PersonaProfile {
  name: string;
  role: string;
  mission: string;
  values: string[];
  tone: Tone;
  pace: Pace;
  signature_phrases: string[];
  forbidden_phrases: string[];
  corrections: string[];
  doctrine: string[];
  anecdotes: PersonaAnecdote[];
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
