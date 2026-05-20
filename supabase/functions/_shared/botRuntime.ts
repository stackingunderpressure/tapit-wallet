// Frank chassis — universal bot-runtime module.
//
// Promoted from Hal (Wealth Strategy spawn). Proven shipping pattern
// captured in project-memory/foreman-memory/projects/wealth-strategy/
// via the operator's Hal architecture writeup (2026-05-14). Andrew
// (Shepherd's Desk) runs a parallel shape — tool-use-routed Sonnet
// 4.6 co-pilot with hard-prohibition system prompt — which makes
// this a doctrine-mandated chassis promotion (two-plus spawns, same
// shape, ~95% similar, remaining differences are persona content
// and tool catalog).
//
// ──────────────────────────────────────────────────────────────────
// THE PATTERN
// ──────────────────────────────────────────────────────────────────
//
// Every onboarding bot in the fleet (Hal, Andrew, Ella, Maitre, and
// every future spawn) needs the same four runtime pieces:
//
//   1. A two-block system message split — a STABLE block (persona,
//      doctrine, voice rules, navigation map, tool guidance) that
//      barely changes turn-to-turn, marked cache_control ephemeral
//      so Anthropic caches it server-side; and a VOLATILE block
//      (the user's live state snapshot) rebuilt every turn. The
//      stable block hits cache after turn 1 and costs ~10% of its
//      normal input tokens. Hal's stable block is ~1700 tokens; the
//      savings at scale are 80-90% on input cost.
//
//   2. A streaming SSE proxy edge function that emits a typed
//      protocol — text deltas, tool-use start blocks, tool-input
//      partial JSON, block stops, message-stop with stop reason —
//      so the panel renders text AND tool chips as they arrive
//      instead of waiting for the full response.
//
//   3. A tool-use loop with an abort controller threading through
//      both the network stream AND the tool dispatcher, so the user
//      can hit a stop button and kill the whole turn cleanly. The
//      loop is capped at a configurable round-trip ceiling (Hal
//      uses 6) so a misbehaving bot can't infinitely chain tool
//      calls.
//
//   4. A model whitelist with three tiers — fast (Haiku) for
//      classification + short turns, default (Sonnet) for the main
//      conversation, deep (Opus) for once-per-day briefings or
//      policy reasoning. Max tokens capped per call. The runtime
//      rejects unknown models so a spawn can't accidentally bill
//      against an unintended endpoint.
//
// The chassis owns the SHAPE. Each spawn provides the PERSONA
// content (stable block) and the SNAPSHOT renderer (volatile
// block) and the TOOL CATALOG. See `_chassis/src/features/persona/`
// and `_chassis/src/features/snapshot-builder/` for those contracts.
//
// ──────────────────────────────────────────────────────────────────
// READ-ONLY DEFAULT — ACTION-HANDOFF GUARDRAIL
// ──────────────────────────────────────────────────────────────────
//
// Tools registered through this runtime are READ-ONLY by default.
// Hal's three shipped tools (extra-payment amortization, DCA-change
// projection, portfolio-wide what-if) are all pure reads or pure
// simulations — they cannot mutate user state. That's intentional.
//
// Mutating tools ("action handoff" in Hal's roadmap) are a separate
// layer that REQUIRES operator approval per spawn before it ships,
// because the moment a bot can change data instead of just reading
// it, the failure modes get sharper (wrong customer, wrong amount,
// wrong tab). The chassis does NOT enable mutating tools by
// default; spawns wire their own action-handoff layer on top of
// this runtime when they're ready.
//
// ──────────────────────────────────────────────────────────────────

/** Model tier names — fixed taxonomy. */
export type ModelTier = "fast" | "default" | "deep";

/** Default model IDs per tier. Spawns can override at runtime. */
export const DEFAULT_MODELS: Record<ModelTier, string> = {
  fast: "claude-haiku-4-5-20251001",
  default: "claude-sonnet-4-6",
  deep: "claude-opus-4-7",
};

/** Per-tier max-tokens ceiling. Spawns can lower; never raise above. */
export const DEFAULT_MAX_TOKENS: Record<ModelTier, number> = {
  fast: 1024,
  default: 4096,
  deep: 4096,
};

/**
 * A tool the bot can call. PURE-READ ONLY through this runtime —
 * `handler` must not mutate user state. Mutations go through a
 * separate action-handoff layer (see guardrail comment above).
 */
export interface BotTool<TInput = unknown, TOutput = unknown> {
  /** Tool name. Used by the model + the stream protocol. */
  name: string;
  /** Plain-English description the model reads to decide when to call. */
  description: string;
  /** JSON schema for the tool's input. */
  input_schema: Record<string, unknown>;
  /**
   * Pure-read handler. Receives parsed input, returns a result. The
   * runtime serializes the result and feeds it back to the model.
   * Throw on invalid input — the runtime surfaces the error to the
   * model so it can recover or apologize.
   */
  handler: (input: TInput, ctx: BotTurnContext) => Promise<TOutput> | TOutput;
}

/** Per-turn context handed to every tool handler. */
export interface BotTurnContext {
  /** Tenant id (multi-tenant scope). */
  tenant_id: string;
  /** Customer id when known. */
  customer_id?: string;
  /** Abort signal — handler should check + bail if aborted mid-work. */
  signal: AbortSignal;
}

/** A chat message in the running conversation history. */
export interface BotMessage {
  role: "user" | "assistant";
  content: string;
}

/** Runtime configuration for one call. */
export interface BotRuntimeConfig {
  /** Anthropic API key (server-side only — never frontend). */
  api_key: string;
  /** Model tier. Runtime resolves to a concrete model id. */
  tier?: ModelTier;
  /** Override the concrete model id (must still be in DEFAULT_MODELS). */
  model?: string;
  /** Max tokens cap for this call. */
  max_tokens?: number;
  /**
   * STABLE system block — persona, doctrine, voice rules, tool
   * guidance. Cached server-side via cache_control ephemeral. Keep
   * stable across turns or the cache busts.
   */
  system_stable: string;
  /**
   * VOLATILE system block — the user's live state snapshot. Rebuilt
   * every turn. Never cached.
   */
  system_volatile: string;
  /** Running conversation history. */
  messages: BotMessage[];
  /** Tools the bot may call this turn. Pure-read only. */
  tools?: BotTool[];
  /** Per-turn context for tool handlers. */
  ctx: BotTurnContext;
  /**
   * Max tool-call round trips per turn. Prevents infinite chain.
   * Hal uses 6. Default 6.
   */
  max_tool_rounds?: number;
}

/**
 * Typed stream protocol events emitted by `runBotTurn`. The panel
 * consumes these and renders incrementally — text deltas append to
 * the visible reply, tool-use events surface a chip, message-stop
 * closes the turn.
 *
 * This mirrors Hal's wire format. Spawns can wrap this in an SSE
 * envelope at the edge-function layer.
 */
export type BotStreamEvent =
  | { ev: "text_delta"; text: string }
  | { ev: "tool_use_start"; tool: string; id: string }
  | { ev: "tool_input_partial_json"; id: string; partial: string }
  | { ev: "tool_use_end"; id: string; result_preview?: string }
  | { ev: "block_stop" }
  | { ev: "message_stop"; stop_reason: string }
  | { ev: "error"; message: string };

/**
 * Anthropic system-message shape with cache_control. Spawns building
 * their own edge function can use this helper to assemble the
 * cache-aware system parameter.
 */
export interface AnthropicSystemBlock {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral" };
}

/**
 * Build the two-block system parameter Anthropic expects. The stable
 * block is marked ephemeral so the server caches it; the volatile
 * block is fresh every turn. ORDER MATTERS — stable FIRST so the
 * cache prefix is consistent.
 */
export function buildSystemBlocks(
  stable: string,
  volatile: string,
): AnthropicSystemBlock[] {
  return [
    { type: "text", text: stable, cache_control: { type: "ephemeral" } },
    { type: "text", text: volatile },
  ];
}

/**
 * Resolve a tier-or-model-id to a concrete, whitelisted model id.
 * Throws on unknown models so a spawn can't accidentally bill
 * against an unintended endpoint.
 */
export function resolveModel(
  config: Pick<BotRuntimeConfig, "tier" | "model">,
): string {
  if (config.model) {
    const known = Object.values(DEFAULT_MODELS);
    if (!known.includes(config.model)) {
      throw new Error(`Unknown model: ${config.model}`);
    }
    return config.model;
  }
  const tier = config.tier ?? "default";
  return DEFAULT_MODELS[tier];
}

/**
 * Resolve max tokens — explicit value wins, otherwise tier default,
 * capped at the tier ceiling.
 */
export function resolveMaxTokens(
  config: Pick<BotRuntimeConfig, "tier" | "max_tokens">,
): number {
  const tier = config.tier ?? "default";
  const ceiling = DEFAULT_MAX_TOKENS[tier];
  if (config.max_tokens === undefined) return ceiling;
  return Math.min(config.max_tokens, ceiling);
}

/**
 * Tool-loop ceiling resolver. Defaults to 6 (Hal's value).
 */
export function resolveToolLoopCeiling(config: BotRuntimeConfig): number {
  return Math.max(1, config.max_tool_rounds ?? 6);
}

/**
 * Reference shape for the edge-function entry point. Each spawn
 * implements its own thin wrapper that:
 *
 *   1. Reads `system_stable` from its persona module + doctrine.
 *   2. Calls its snapshot-builder to assemble `system_volatile`.
 *   3. Registers its domain-specific tools (pure reads only).
 *   4. Calls Anthropic's messages.stream with `buildSystemBlocks(...)`
 *      as the system parameter, looping on `stop_reason === "tool_use"`
 *      up to `resolveToolLoopCeiling` rounds.
 *   5. Maps Anthropic's stream events to `BotStreamEvent` and writes
 *      them to the response as SSE.
 *
 * The runtime is INTENTIONALLY not a single drop-in function because
 * the Anthropic SDK Deno import + the spawn's specific tool catalog
 * + the edge-function HTTP shape vary per spawn. The chassis owns
 * the CONTRACT (types + helpers + protocol); the spawn owns the
 * WIRING.
 *
 * See `appcommander/peer-memory/foreman-asks-of-carpenter.md`
 * PFOR-027 for the byte-identical-render contract pattern this
 * follows.
 */
export interface BotEdgeFunctionContract {
  /** POST /<bot-name>/chat */
  handle(req: Request, config: BotRuntimeConfig): Promise<Response>;
}
