/**
 * Format a Unix-seconds timestamp into a short human label used as
 * the divider above a group of messages. Same-day messages collapse
 * under a single time-of-day header; older messages get a date.
 */
export function formatBubbleHeader(ts: number, now: number): string {
  const d = new Date(ts * 1000);
  const n = new Date(now * 1000);
  const sameDay =
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  const sameYear = d.getFullYear() === n.getFullYear();
  return sameYear
    ? d.toLocaleDateString([], { month: 'short', day: 'numeric' })
    : d.toLocaleDateString();
}
