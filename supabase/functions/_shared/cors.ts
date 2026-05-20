// Frank chassis — universal CORS headers helper.
//
// Every edge function in a spawned app imports this from
// `../_shared/cors.ts`. Single source of truth so a spawn can tighten
// the allowed origin in one place if it ever leaves dev.

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

/**
 * Standard OPTIONS preflight handler. Returns a 204 with the chassis
 * CORS headers attached. Use at the top of every edge function's fetch
 * handler:
 *
 *     if (req.method === "OPTIONS") return handleOptions();
 */
export function handleOptions(): Response {
  return new Response(null, { status: 204, headers: corsHeaders });
}
