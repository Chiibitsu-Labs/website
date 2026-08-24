// Slot times are stored as real UTC instants (startISO/endISO), so they can be
// rendered in ANY timezone. The server pre-formats labels in the host timezone,
// but a booker in another country must see their own — otherwise a slot shown
// as "9:00 AM" (Manila) is 9:00 PM the previous day in Toronto, and they book
// the wrong time by twelve hours.

export const HOST_TIMEZONE = process.env.NEXT_PUBLIC_TIMEZONE ?? 'Asia/Manila';

/** "9:00 PM" in the given IANA timezone. */
export function formatTimeInZone(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso));
}

/** "Mon, Aug 24" in the given IANA timezone. */
export function formatDateInZone(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(iso));
}

/** "Monday, August 24, 2026" in the given IANA timezone. */
export function formatLongDateInZone(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso));
}

/** "EDT", "GMT+8" — the short zone name as of that instant (handles DST). */
export function zoneAbbreviation(timeZone: string, at: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'short',
  }).formatToParts(at);
  return parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
}

/** "America/Toronto" -> "Toronto". Falls back to the raw id if unusual. */
export function friendlyZoneName(timeZone: string): string {
  const last = timeZone.split('/').pop();
  return last ? last.replace(/_/g, ' ') : timeZone;
}

/** "Toronto time (EDT)" — for labelling times shown to a viewer. */
export function zoneDescription(timeZone: string, at: Date = new Date()): string {
  const abbr = zoneAbbreviation(timeZone, at);
  const name = friendlyZoneName(timeZone);
  return abbr ? `${name} time (${abbr})` : `${name} time`;
}

/**
 * Two zones can have different ids but the same wall-clock time
 * (e.g. Asia/Manila vs Asia/Taipei), in which case there is nothing to
 * clarify — compare actual offsets rather than the id strings.
 */
export function zonesDiffer(a: string, b: string, at: Date = new Date()): boolean {
  if (a === b) return false;
  return formatTimeInZone(at.toISOString(), a) !== formatTimeInZone(at.toISOString(), b);
}
