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

/**
 * The booker's own answer, asked only when the project offers both modes. It
 * is meaningful ONLY while the project still offers the choice: if the project
 * is later fixed to online, a face-to-face answer from before is stale, not an
 * instruction.
 */
export const BOOKER_LOCATION_KEY = 'location_choice';

/**
 * The admin's per-booking override, set from the admin panel and valid on any
 * project — booking one online client against a face-to-face project is what
 * it exists for.
 *
 * A separate key from the booker's answer on purpose. Both used to share
 * `location_choice`, which left the reschedule token unable to say which it
 * held: carrying it forward preserved a real admin override but also revived a
 * booker's stale choice against a project whose mode had since changed. The
 * provenance has to live in the data; it cannot be inferred later.
 */
export const ADMIN_LOCATION_KEY = 'location_override';
