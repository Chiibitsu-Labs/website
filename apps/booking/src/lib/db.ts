import { unstable_noStore as noStore } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import type { Project, TimeSlotTemplate, CustomField } from '@/config/projects';
import { SEED_PROJECTS } from '@/config/projects';

interface ProjectRow {
  id: string;
  slug: string;
  name: string;
  company: string;
  tagline: string;
  description: string;
  duration_minutes: number;
  branding_color: string;
  branding_emoji: string | null;
  time_slots: TimeSlotTemplate[];
  custom_fields: CustomField[];
  booking_window_weeks: number;
  blocked_dates: string[];
  calendar_id: string | null;
  is_active: boolean;
  is_paid: boolean;
  sort_order: number;
  location_type: string | null;
  calendar_event_title_template: string | null;
  created_at: string;
}

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export function hasDatabase(): boolean {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function rowToProject(row: ProjectRow): Project {
  return {
    slug: row.slug,
    name: row.name,
    company: row.company,
    tagline: row.tagline,
    description: row.description,
    durationMinutes: row.duration_minutes,
    branding: {
      primaryColor: row.branding_color,
      shade: '700',
      lightShade: '50',
      emoji: row.branding_emoji ?? undefined,
    },
    timeSlots: row.time_slots ?? [],
    customFields: row.custom_fields ?? [],
    bookingWindowWeeks: row.booking_window_weeks,
    blockedDates: row.blocked_dates ?? [],
    calendarId: row.calendar_id ?? undefined,
    isPaid: row.is_paid ?? false,
    sortOrder: row.sort_order ?? 0,
    locationType:
      row.location_type === 'in_person' || row.location_type === 'either'
        ? row.location_type
        : 'online',
    calendarEventTitleTemplate: row.calendar_event_title_template ?? undefined,
  };
}

export async function getProjects(): Promise<Project[]> {
  noStore(); // never serve a cached project list — admin edits must show immediately
  const client = getClient();
  if (!client) return SEED_PROJECTS;

  // Fetch paused rows too, then filter here. Filtering in the query made an
  // empty result ambiguous: "table not seeded yet" and "every project is
  // paused" looked identical, and the latter fell through to SEED_PROJECTS —
  // so pausing everything would advertise the two hard-coded seed sessions as
  // bookable. An existing row means the table IS seeded; an empty active list
  // is then a real answer, not a reason to substitute seed data.
  const { data, error } = await client
    .from('booking_projects')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('DB getProjects error:', error);
    return SEED_PROJECTS;
  }
  const all: ProjectRow[] = data ?? [];
  if (all.length === 0) return SEED_PROJECTS;
  return all.filter((row) => row.is_active).map(rowToProject);
}

/**
 * The row for this slug, `is_active` ignored.
 *
 * `answered: false` means the database could not tell us anything (not
 * configured, or the query failed) — only then may seed data stand in. It is
 * deliberately distinct from `row: null`, which is a definite "no such
 * project": conflating the two is what let a PAUSED seed-slug project keep
 * serving hard-coded seed config instead of disappearing.
 */
async function loadProjectRow(
  slug: string,
): Promise<{ row: ProjectRow | null; answered: boolean }> {
  const client = getClient();
  if (!client) return { row: null, answered: false };

  const { data, error } = await client
    .from('booking_projects')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    console.error('DB project lookup error:', error);
    return { row: null, answered: false };
  }
  return { row: (data as ProjectRow) ?? null, answered: true };
}

/** Seed data stands in only where it always has: an unanswerable database, or
 *  a slug with no row at all (the table may simply not be seeded yet). */
function seedFallback(slug: string): Project | null {
  return SEED_PROJECTS.find((p) => p.slug === slug) ?? null;
}

export async function getProjectBySlug(slug: string): Promise<Project | null> {
  noStore(); // always read the live row so admin changes (location, colour, copy) show immediately
  const { row, answered } = await loadProjectRow(slug);
  if (!answered) return seedFallback(slug);
  if (!row) return seedFallback(slug);
  // A row that exists but is paused is a definite no. Filtering is_active in
  // the query instead made "paused" indistinguishable from "absent", so the two
  // seed slugs (ai-at-work, aicos-fit-call) fell through to SEED_PROJECTS and
  // stayed publicly bookable after being paused — on the seed's duration, slot
  // templates and default calendar rather than the project's real settings.
  if (!row.is_active) return null;
  return rowToProject(row);
}

/**
 * Same lookup, but ignoring `is_active` — for holders of a valid, signed
 * reschedule token naming this project, and for the Telegram approval step.
 *
 * A project can be paused after a client is booked on it. Their reschedule link
 * would otherwise 404, stranding someone already booked. Pausing stops NEW
 * bookings; it must not strand existing clients.
 */
export async function getProjectBySlugIncludingPaused(slug: string): Promise<Project | null> {
  noStore();
  const { row, answered } = await loadProjectRow(slug);
  if (!answered) return seedFallback(slug);
  if (!row) return seedFallback(slug);
  return rowToProject(row);
}

/**
 * THE rule for which public surfaces may see a paused project, in one place.
 *
 * A reschedule token is proof the holder is already booked — but only on the
 * project the token itself names. Without that match, any live token (or one
 * forwarded to someone else) would unlock every paused project on the site:
 * an unlaunched draft's page would render, and /api/book would take a booking
 * on it, defeating the pause entirely.
 *
 * The page, /api/availability and /api/book each verify their own token (they
 * need the payload anyway) and then come here, so the three cannot drift.
 */
export function rescheduleTokenMatchesProject(
  payload: { projectSlug: string } | null | undefined,
  slug: string,
): boolean {
  return payload?.projectSlug === slug;
}

/** Active-only by default; paused too for a token that names this project. */
export async function resolveProjectForSlug(
  slug: string,
  reschedulePayload: { projectSlug: string } | null | undefined,
): Promise<Project | null> {
  return rescheduleTokenMatchesProject(reschedulePayload, slug)
    ? getProjectBySlugIncludingPaused(slug)
    : getProjectBySlug(slug);
}

export async function getAllProjectsAdmin(): Promise<(Project & { isActive: boolean; id: string })[]> {
  noStore();
  const client = getClient();
  if (!client) return [];

  const { data, error } = await client
    .from('booking_projects')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row: ProjectRow) => ({
    ...rowToProject(row),
    isActive: row.is_active,
    id: row.id,
  }));
}

export interface ProjectInput {
  slug: string;
  name: string;
  company: string;
  tagline: string;
  description: string;
  durationMinutes: number;
  brandingColor: string;
  brandingEmoji?: string;
  timeSlots: TimeSlotTemplate[];
  customFields: CustomField[];
  bookingWindowWeeks: number;
  calendarId?: string;
  isPaid?: boolean;
  sortOrder?: number;
  locationType?: 'online' | 'in_person' | 'either';
  calendarEventTitleTemplate?: string;
}

export async function createProject(input: ProjectInput): Promise<Project> {
  const client = getClient();
  if (!client) throw new Error('Database not configured');

  const { data, error } = await client
    .from('booking_projects')
    .insert({
      slug: input.slug,
      name: input.name,
      company: input.company,
      tagline: input.tagline,
      description: input.description,
      duration_minutes: input.durationMinutes,
      branding_color: input.brandingColor,
      branding_emoji: input.brandingEmoji ?? null,
      time_slots: input.timeSlots,
      custom_fields: input.customFields,
      booking_window_weeks: input.bookingWindowWeeks,
      calendar_id: input.calendarId ?? null,
      is_paid: input.isPaid ?? false,
      sort_order: input.sortOrder ?? 0,
      location_type: input.locationType ?? 'online',
      calendar_event_title_template: input.calendarEventTitleTemplate ?? null,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;
  return rowToProject(data);
}

export async function updateProject(slug: string, input: Partial<ProjectInput> & { isActive?: boolean }): Promise<Project> {
  const client = getClient();
  if (!client) throw new Error('Database not configured');

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.company !== undefined) patch.company = input.company;
  if (input.tagline !== undefined) patch.tagline = input.tagline;
  if (input.description !== undefined) patch.description = input.description;
  if (input.durationMinutes !== undefined) patch.duration_minutes = input.durationMinutes;
  if (input.brandingColor !== undefined) patch.branding_color = input.brandingColor;
  if ('brandingEmoji' in input) patch.branding_emoji = input.brandingEmoji ?? null;
  if (input.timeSlots !== undefined) patch.time_slots = input.timeSlots;
  if (input.customFields !== undefined) patch.custom_fields = input.customFields;
  if (input.bookingWindowWeeks !== undefined) patch.booking_window_weeks = input.bookingWindowWeeks;
  if ('calendarId' in input) patch.calendar_id = input.calendarId ?? null;
  if (input.isPaid !== undefined) patch.is_paid = input.isPaid;
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
  if (input.locationType !== undefined) patch.location_type = input.locationType;
  if ('calendarEventTitleTemplate' in input) patch.calendar_event_title_template = input.calendarEventTitleTemplate ?? null;
  if (input.isActive !== undefined) patch.is_active = input.isActive;

  const { data, error } = await client
    .from('booking_projects')
    .update(patch)
    .eq('slug', slug)
    .select()
    .single();

  if (error) throw error;
  return rowToProject(data);
}

export async function deleteProject(slug: string): Promise<void> {
  const client = getClient();
  if (!client) throw new Error('Database not configured');

  const { error } = await client
    .from('booking_projects')
    .delete()
    .eq('slug', slug);

  if (error) throw error;
}

export async function seedProjects(): Promise<void> {
  const client = getClient();
  if (!client) throw new Error('Database not configured');

  for (const p of SEED_PROJECTS) {
    const { error } = await client.from('booking_projects').upsert(
      {
        slug: p.slug,
        name: p.name,
        company: p.company,
        tagline: p.tagline,
        description: p.description,
        duration_minutes: p.durationMinutes,
        branding_color: p.branding.primaryColor,
        branding_emoji: p.branding.emoji ?? null,
        time_slots: p.timeSlots,
        custom_fields: p.customFields,
        booking_window_weeks: p.bookingWindowWeeks,
        blocked_dates: p.blockedDates ?? [],
        calendar_id: p.calendarId ?? null,
        is_active: true,
      },
      { onConflict: 'slug' },
    );
    if (error) throw new Error(`Seed failed for "${p.slug}": ${error.message}`);
  }
}
