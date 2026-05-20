// Frank chassis — persona parity contract test.
//
// PFOR-027: the Deno-side persona module
// (supabase/functions/_shared/persona.ts) and the frontend mirror
// (src/features/persona/types.ts) MUST stay byte-identical in:
//
//   - type shape (PersonaProfile keys + value types, plus
//     IdentityBlend + PersonaAnecdote sub-types in v2)
//   - DEFAULT_PERSONA constant
//   - renderPersonaSystemPrompt(persona, providerName) output
//   - applyCorrection / addDoctrinePrinciple / addAnecdote output
//
// This test asserts parity. Every spawn that consumes the chassis
// runs this test as part of its `npm test` gate. A failing
// assertion means one side drifted — fix BOTH files, re-run, then
// commit.
//
// v2 expansion (2026-05-14, chassis harvest pass): added coverage
// for doctrine, anecdotes, and identity_blend fields. See
// CHANGELOG.md for promotion lineage (Andrew + Hal).

import { describe, expect, it } from "vitest";

// @ts-expect-error — Deno-side module imported into vitest context.
// Pure TS, no Deno-only globals, so the import resolves cleanly.
import * as serverPersona from "../../supabase/functions/_shared/persona";
import * as clientPersona from "../features/persona/types";

describe("persona PFOR-027 parity", () => {
  it("DEFAULT_PERSONA constants are byte-identical", () => {
    expect(JSON.stringify(serverPersona.DEFAULT_PERSONA)).toBe(
      JSON.stringify(clientPersona.DEFAULT_PERSONA),
    );
  });

  it("renderPersonaSystemPrompt produces byte-identical output (defaults)", () => {
    const persona = clientPersona.DEFAULT_PERSONA;
    const provider = "Acme Salon";
    expect(serverPersona.renderPersonaSystemPrompt(persona, provider)).toBe(
      clientPersona.renderPersonaSystemPrompt(persona, provider),
    );
  });

  it("renderPersonaSystemPrompt handles populated lists identically", () => {
    const persona: clientPersona.PersonaProfile = {
      name: "Ella",
      role: "salon concierge",
      mission: "Help every guest feel beautiful and remembered.",
      values: ["clarity", "warmth"],
      tone: "warm",
      pace: "balanced",
      signature_phrases: ["take your time"],
      forbidden_phrases: ["upgrade your package"],
      corrections: ["never ask how their day is going twice"],
      doctrine: [],
      anecdotes: [],
    };
    const provider = "Bree's Cuts";
    expect(serverPersona.renderPersonaSystemPrompt(persona, provider)).toBe(
      clientPersona.renderPersonaSystemPrompt(persona, provider),
    );
  });

  it("renderPersonaSystemPrompt handles doctrine field identically", () => {
    const persona: clientPersona.PersonaProfile = {
      ...clientPersona.DEFAULT_PERSONA,
      doctrine: [
        "fixed supply is a discipline, not a feature",
        "cryptographic proof replaces trust",
        "technology serves the individual",
      ],
    };
    const provider = "Wealth Strategy";
    expect(serverPersona.renderPersonaSystemPrompt(persona, provider)).toBe(
      clientPersona.renderPersonaSystemPrompt(persona, provider),
    );
  });

  it("renderPersonaSystemPrompt handles anecdotes field identically", () => {
    const persona: clientPersona.PersonaProfile = {
      ...clientPersona.DEFAULT_PERSONA,
      anecdotes: [
        {
          id: "first-tx-2009",
          cue_tags: ["origin", "trust"],
          text: "I received the first Bitcoin transaction in January 2009.",
        },
        {
          id: "version-zero-one-heat",
          cue_tags: ["technical", "early-days"],
          text: "Running version 0.1 warmed the room on a winter morning.",
        },
      ],
    };
    const provider = "Wealth Strategy";
    expect(serverPersona.renderPersonaSystemPrompt(persona, provider)).toBe(
      clientPersona.renderPersonaSystemPrompt(persona, provider),
    );
  });

  it("renderPersonaSystemPrompt handles identity_blend identically", () => {
    const persona: clientPersona.PersonaProfile = {
      ...clientPersona.DEFAULT_PERSONA,
      identity_blend: {
        primary: "Hal Finney",
        primary_brings:
          "warmth, patience, and cypherpunk history going back to 1992",
        secondary: "Satoshi Nakamoto",
        secondary_brings:
          "terseness, first-principles thinking, and doctrinal discipline",
        attribution_rules: [
          "never claim to be Satoshi",
          "never speak as if Hal Finney is alive today",
        ],
      },
    };
    const provider = "Wealth Strategy";
    expect(serverPersona.renderPersonaSystemPrompt(persona, provider)).toBe(
      clientPersona.renderPersonaSystemPrompt(persona, provider),
    );
  });

  it("renderPersonaSystemPrompt handles the full v2 surface identically", () => {
    const persona: clientPersona.PersonaProfile = {
      name: "Hal",
      role: "wealth advisor",
      mission:
        "Help the user build wealth through discipline and patience.",
      values: ["honesty over flattery", "time is the asset's secret"],
      tone: "calming",
      pace: "balanced",
      signature_phrases: ["the math is the math"],
      forbidden_phrases: ["this is financial advice"],
      corrections: ["never predict price targets with confidence"],
      doctrine: [
        "fixed supply is a discipline",
        "cryptographic proof replaces trust",
        "time is the asset's secret",
      ],
      anecdotes: [
        {
          id: "first-tx",
          cue_tags: ["origin"],
          text: "I received the first Bitcoin transaction in 2009.",
        },
      ],
      identity_blend: {
        primary: "Hal Finney",
        primary_brings: "warmth + cypherpunk history",
        secondary: "Satoshi",
        secondary_brings: "terseness + first-principles thinking",
        attribution_rules: [
          "never claim to be Satoshi",
          "never speak as if Hal Finney is alive today",
        ],
      },
    };
    const provider = "Wealth Strategy";
    expect(serverPersona.renderPersonaSystemPrompt(persona, provider)).toBe(
      clientPersona.renderPersonaSystemPrompt(persona, provider),
    );
  });

  it("applyCorrection produces byte-identical output", () => {
    const base = clientPersona.DEFAULT_PERSONA;
    const correction = "always confirm the time before ending";
    expect(
      JSON.stringify(serverPersona.applyCorrection(base, correction)),
    ).toBe(JSON.stringify(clientPersona.applyCorrection(base, correction)));
  });

  it("applyCorrection is idempotent on both sides", () => {
    const base = clientPersona.DEFAULT_PERSONA;
    const correction = "always confirm the time before ending";
    const onceServer = serverPersona.applyCorrection(base, correction);
    const twiceServer = serverPersona.applyCorrection(onceServer, correction);
    const onceClient = clientPersona.applyCorrection(base, correction);
    const twiceClient = clientPersona.applyCorrection(onceClient, correction);
    expect(JSON.stringify(twiceServer)).toBe(JSON.stringify(onceServer));
    expect(JSON.stringify(twiceClient)).toBe(JSON.stringify(onceClient));
    expect(JSON.stringify(twiceServer)).toBe(JSON.stringify(twiceClient));
  });

  it("applyCorrection ignores empty/whitespace corrections identically", () => {
    const base = clientPersona.DEFAULT_PERSONA;
    expect(JSON.stringify(serverPersona.applyCorrection(base, "   "))).toBe(
      JSON.stringify(base),
    );
    expect(JSON.stringify(clientPersona.applyCorrection(base, "   "))).toBe(
      JSON.stringify(base),
    );
  });

  it("addDoctrinePrinciple is idempotent + byte-identical", () => {
    const base = clientPersona.DEFAULT_PERSONA;
    const p = "fixed supply is a discipline";
    const onceServer = serverPersona.addDoctrinePrinciple(base, p);
    const twiceServer = serverPersona.addDoctrinePrinciple(onceServer, p);
    const onceClient = clientPersona.addDoctrinePrinciple(base, p);
    expect(JSON.stringify(twiceServer)).toBe(JSON.stringify(onceServer));
    expect(JSON.stringify(onceServer)).toBe(JSON.stringify(onceClient));
  });

  it("addAnecdote is idempotent on id + byte-identical", () => {
    const base = clientPersona.DEFAULT_PERSONA;
    const a: clientPersona.PersonaAnecdote = {
      id: "first-tx",
      cue_tags: ["origin"],
      text: "I received the first Bitcoin transaction in 2009.",
    };
    const onceServer = serverPersona.addAnecdote(base, a);
    const twiceServer = serverPersona.addAnecdote(onceServer, a);
    const onceClient = clientPersona.addAnecdote(base, a);
    expect(JSON.stringify(twiceServer)).toBe(JSON.stringify(onceServer));
    expect(JSON.stringify(onceServer)).toBe(JSON.stringify(onceClient));
  });
});
