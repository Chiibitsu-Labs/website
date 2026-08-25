/**
 * The two delivery modes a booker can choose, in one place.
 *
 * Lives in its own module rather than in google-calendar.ts because client
 * components need the values, and importing a runtime binding from that file
 * would pull googleapis into the browser bundle.
 *
 * Matching on the exact value matters: deciding "in person" by testing whether
 * the string starts with "face" means a relabelled button, or a hand-crafted
 * POST, silently flips a booking to the wrong format.
 */
export const LOCATION_CHOICES = ['Online', 'Face to face'] as const;

export type LocationChoice = (typeof LOCATION_CHOICES)[number];

export function isLocationChoice(value: unknown): value is LocationChoice {
  return (
    typeof value === 'string' && (LOCATION_CHOICES as readonly string[]).includes(value)
  );
}

/** True only for the exact in-person value — never a prefix guess. */
export function isInPersonChoice(value: string | undefined): boolean {
  return value === 'Face to face';
}
