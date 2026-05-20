// Frank chassis — temporal context module.
//
// Promoted from Andrew (Shepherd's Desk). Every onboarding bot needs
// a temporal sense — what day is it, what part of the day, what
// timezone is the user in, how long has it been since the last
// conversation, how long since the last meaningful event (sermon,
// appointment, dish-out, BTC buy). Without it, bots drift into
// vague "lately" / "recently" language that doesn't match the
// calendar.
//
// Andrew has shipped this pattern in production; the chassis lifts
// the shape so every spawn inherits it. Hal also uses a lighter
// version for the "days since last buy" line in his snapshot.
//
// ──────────────────────────────────────────────────────────────────
// THE CONTRACT
// ──────────────────────────────────────────────────────────────────
//
// A spawn calls `buildTemporalContext(...)` with the tenant's
// timezone + the timestamps of relevant last-events (last
// appointment, last sermon, last BTC buy, last conversation). The
// function returns a `TemporalContext` object the spawn can include
// in its volatile system block via a snapshot section.
//
// The shape is intentionally domain-agnostic — `last_events` is a
// Record<string, Date | null> the spawn fills with whatever its
// vertical cares about ("last_appointment", "last_sermon",
// "last_btc_buy", etc.).

export type PartOfDay =
  | "early_morning"
  | "morning"
  | "midday"
  | "afternoon"
  | "evening"
  | "night"
  | "overnight";

export type DayOfWeek =
  | "Sunday"
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday";

export interface TemporalContext {
  /** ISO 8601 timestamp at the moment of context build. */
  iso: string;
  /** IANA timezone (e.g. "America/New_York"). */
  timezone: string;
  /** Local date string in YYYY-MM-DD form. */
  local_date: string;
  /** Local time string in HH:MM 24h form. */
  local_time: string;
  /** Day of the week, local. */
  day_of_week: DayOfWeek;
  /** Coarse part-of-day bucket, local. */
  part_of_day: PartOfDay;
  /** Whether today is a weekend, local. */
  is_weekend: boolean;
  /**
   * Days since each named last-event. null when the event has never
   * happened. Spawn-defined keys.
   */
  days_since: Record<string, number | null>;
  /**
   * Optional vertical-specific season string the spawn computes
   * (Andrew computes liturgical season; a salon might compute
   * "summer-wedding-season"; restaurants might compute "post-Thanksgiving-slump").
   */
  season?: string;
}

/** Build a TemporalContext for "now" in the given timezone. */
export function buildTemporalContext(args: {
  now?: Date;
  timezone: string;
  last_events?: Record<string, Date | null | undefined>;
  season?: string;
}): TemporalContext {
  const now = args.now ?? new Date();
  const timezone = args.timezone;

  // Format date + time in target timezone using Intl APIs.
  const dateFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const timeFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const dowFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
  });

  const local_date = dateFmt.format(now);
  const local_time = timeFmt.format(now);
  const day_of_week = dowFmt.format(now) as DayOfWeek;

  // Coarse part-of-day bucket from the local hour.
  const hour = Number(local_time.slice(0, 2));
  let part_of_day: PartOfDay;
  if (hour < 5) part_of_day = "overnight";
  else if (hour < 8) part_of_day = "early_morning";
  else if (hour < 11) part_of_day = "morning";
  else if (hour < 14) part_of_day = "midday";
  else if (hour < 17) part_of_day = "afternoon";
  else if (hour < 21) part_of_day = "evening";
  else part_of_day = "night";

  const is_weekend = day_of_week === "Saturday" || day_of_week === "Sunday";

  const days_since: Record<string, number | null> = {};
  for (const [key, value] of Object.entries(args.last_events ?? {})) {
    if (!value) {
      days_since[key] = null;
      continue;
    }
    const diff_ms = now.getTime() - value.getTime();
    days_since[key] = Math.max(0, Math.floor(diff_ms / 86_400_000));
  }

  return {
    iso: now.toISOString(),
    timezone,
    local_date,
    local_time,
    day_of_week,
    part_of_day,
    is_weekend,
    days_since,
    season: args.season,
  };
}

/**
 * Render the TemporalContext as a prose paragraph suitable for the
 * volatile system block. Speech-friendly per PFOR-014/PFOR-018 — no
 * bullets, no tables, just prose the model can read and reason over.
 */
export function renderTemporalContextProse(ctx: TemporalContext): string {
  const parts: string[] = [];
  parts.push(
    `It is ${ctx.local_time} on ${ctx.day_of_week}, ${ctx.local_date} (${ctx.timezone}, ${ctx.part_of_day.replace("_", " ")}).`,
  );
  if (ctx.is_weekend) parts.push("Today is a weekend.");
  if (ctx.season) parts.push(`Season: ${ctx.season}.`);
  const sinceLines: string[] = [];
  for (const [key, value] of Object.entries(ctx.days_since)) {
    if (value === null) {
      sinceLines.push(`${key.replace(/_/g, " ")}: never`);
    } else if (value === 0) {
      sinceLines.push(`${key.replace(/_/g, " ")}: today`);
    } else if (value === 1) {
      sinceLines.push(`${key.replace(/_/g, " ")}: yesterday`);
    } else {
      sinceLines.push(`${key.replace(/_/g, " ")}: ${value} days ago`);
    }
  }
  if (sinceLines.length > 0) {
    parts.push(`Recent activity — ${sinceLines.join("; ")}.`);
  }
  return parts.join(" ");
}
