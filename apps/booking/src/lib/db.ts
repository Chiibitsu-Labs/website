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
  };
}

export async function getProjects(): Promise<Project[]> {
  const client = getClient();
  if (!client) return SEED_PROJECTS;

  const { data, error } = await client
    .from('booking_projects')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('DB getProjects error:', error);
    return SEED_PROJECTS;
  }
  const rows = (data ?? []).map(rowToProject);
  return rows.length > 0 ? rows : SEED_PROJECTS;
}

export async function getProjectBySlug(slug: string): Promise<Project | null> {
  const client = getClient();
  if (!client) {
    return SEED_PROJECTS.find((p) => p.slug === slug) ?? null;
  }

  const { data, error } = await client
    .from('booking_projects')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('DB getProjectBySlug error:', error);
    return SEED_PROJECTS.find((p) => p.slug === slug) ?? null;
  }
  if (!data) return SEED_PROJECTS.find((p) => p.slug === slug) ?? null;
  return rowToProject(data);
}

export async function getAllProjectsAdmin(): Promise<(Project & { isActive: boolean; id: string })[]> {
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
