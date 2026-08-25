import { google, type calendar_v3 } from 'googleapis';
import { addMinutes, format, parseISO, startOfDay, endOfDay, differenceInMinutes } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import type { Project, TimeSlotTemplate } from '@/config/projects';
import { formatDuration, prettifyFieldKey } from './utils';

const TIMEZONE = process.env.NEXT_PUBLIC_TIMEZONE ?? 'Asia/Manila';

function getOAuth2Client() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });
  return client;
}

function getCalendarClient() {
  return google.calendar({ version: 'v3', auth: getOAuth2Client() });
}

export interface TimeSlot {
  startISO: string;
  endISO: string;
  label: string;       // "9:00 AM"
  endLabel: string;    // "1:00 PM"
  available: boolean;
}

function generateSlotsForDate(project: Project, dateStr: string): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const date = parseISO(dateStr);
  const dayOfWeek = date.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;

  const matchingTemplates = project.timeSlots.filter((t: TimeSlotTemplate) =>
    t.days.includes(dayOfWeek),
  );

  for (const template of matchingTemplates) {
    const localStart = new Date(date);
    localStart.setHours(template.startHour, template.startMinute, 0, 0);

    const utcStart = fromZonedTime(localStart, TIMEZONE);
    const utcEnd = addMinutes(utcStart, project.durationMinutes);

    const zonedStart = toZonedTime(utcStart, TIMEZONE);
    const zonedEnd = toZonedTime(utcEnd, TIMEZONE);

    slots.push({
      startISO: utcStart.toISOString(),
      endISO: utcEnd.toISOString(),
      label: format(zonedStart, 'h:mm a'),
      endLabel: format(zonedEnd, 'h:mm a'),
      available: true,
    });
  }

  return slots;
}

export async function getAvailableSlots(
  project: Project,
  dateStr: string,
): Promise<TimeSlot[]> {
  const slots = generateSlotsForDate(project, dateStr);
  if (slots.length === 0) return [];

  // Blocked dates check
  if (project.blockedDates?.includes(dateStr)) {
    return slots.map((s) => ({ ...s, available: false }));
  }

  const calendarId = project.calendarId ?? process.env.GOOGLE_CALENDAR_ID ?? 'primary';

  // Get busy times from Google Calendar
  const date = parseISO(dateStr);
  const dayStart = fromZonedTime(startOfDay(date), TIMEZONE);
  const dayEnd = fromZonedTime(endOfDay(date), TIMEZONE);

  try {
    const calendar = getCalendarClient();
    const freebusyRes = await calendar.freebusy.query({
      requestBody: {
        timeMin: dayStart.toISOString(),
        timeMax: dayEnd.toISOString(),
        timeZone: TIMEZONE,
        items: [{ id: calendarId }],
      },
    });

    const busyTimes =
      freebusyRes.data.calendars?.[calendarId]?.busy ?? [];

    return slots.map((slot) => {
      const slotStart = new Date(slot.startISO).getTime();
      const slotEnd = new Date(slot.endISO).getTime();

      const overlaps = busyTimes.some((busy) => {
        if (!busy.start || !busy.end) return false;
        const busyStart = new Date(busy.start).getTime();
        const busyEnd = new Date(busy.end).getTime();
        return slotStart < busyEnd && slotEnd > busyStart;
      });

      return { ...slot, available: !overlaps };
    });
  } catch (err) {
    console.error('Google Calendar freebusy error:', err);
    // If Calendar API fails, return all slots as available to avoid hard failures
    return slots;
  }
}

export interface BookingDetails {
  projectName: string;
  projectSlug: string;
  company: string;
  bookerName: string;
  bookerEmail: string;
  bookerPhone?: string;
  bookerCompany?: string;
  startISO: string;
  endISO: string;
  customFields: Record<string, string>;
  calendarEventTitleTemplate?: string;
  projectDescription?: string;
  locationType?: 'online' | 'in_person' | 'either';
}

/**
 * Reserved custom-field keys that must never be rendered to the client.
 * `location_choice` is already stated in the location line; `booker_timezone`
 * is plumbing; `admin_note` is written by the admin for their own records and
 * the booker is an attendee on the invite, so it would otherwise reach them.
 */
export const CLIENT_HIDDEN_FIELDS = new Set(['location_choice', 'booker_timezone', 'admin_note']);

/**
 * Stricter than hiding: these must never reach the client by ANY route.
 * The reschedule token is base64url(JSON) + HMAC — signed, not encrypted — and
 * its URL is emailed to the booker, so anything left in it is readable by them.
 */
export const ADMIN_ONLY_FIELDS = new Set(['admin_note']);

/** Custom fields safe to round-trip through a client-held token. */
export function stripAdminOnlyFields(
  fields: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(fields).filter(([k]) => !ADMIN_ONLY_FIELDS.has(k)),
  );
}

/**
 * One human sentence for where the session happens. The booker's own choice
 * wins over the project default; an 'either' project with no recorded choice
 * must not promise a joining link for what might be a face-to-face session.
 * Shared so the invite and the emails cannot drift apart.
 */
export function describeLocation(
  booking: Pick<BookingDetails, 'customFields' | 'locationType'>,
): string {
  const chosen = booking.customFields.location_choice;
  if (!chosen && booking.locationType === 'either') {
    return '🗓 Format to be confirmed — we\'ll agree online or in person with you';
  }
  const isInPerson = chosen
    ? chosen.toLowerCase().startsWith('face')
    : booking.locationType === 'in_person';
  return isInPerson
    ? '📍 In person — we\'ll confirm the exact venue with you'
    : '💻 Online — we\'ll send the joining link before we start';
}

// Warm, client-facing invite body. The booker is an attendee, so this is what
// they read inside their calendar — keep it professional and reassuring.
function buildEventDescription(booking: BookingDetails): string {
  const zonedStart = toZonedTime(new Date(booking.startISO), TIMEZONE);
  const zonedEnd = toZonedTime(new Date(booking.endISO), TIMEZONE);
  const durationLabel = formatDuration(
    differenceInMinutes(new Date(booking.endISO), new Date(booking.startISO)),
  );

  const locationLine = describeLocation(booking);

  const detailRows = [
    `Name: ${booking.bookerName}`,
    `Email: ${booking.bookerEmail}`,
    booking.bookerPhone ? `Phone: ${booking.bookerPhone}` : null,
    booking.bookerCompany ? `Company: ${booking.bookerCompany}` : null,
    ...Object.entries(booking.customFields)
      .filter(([k, v]) => v && !CLIENT_HIDDEN_FIELDS.has(k))
      .map(([k, v]) => `${prettifyFieldKey(k)}: ${v}`),
  ].filter(Boolean);

  const lines = [
    `Hi ${booking.bookerName}! 👋 You're booked for ${booking.projectName} with ${booking.company}.`,
    booking.projectDescription ? `\n${booking.projectDescription}` : null,
    ``,
    `🗓  ${format(zonedStart, 'EEEE, MMMM d, yyyy')}`,
    `🕐  ${format(zonedStart, 'h:mm a')} – ${format(zonedEnd, 'h:mm a')} (Philippine time · UTC+8)`,
    `⏱  ${durationLabel}`,
    locationLine,
    ``,
    `──────────────────`,
    `Your details`,
    ...detailRows,
    `──────────────────`,
    ``,
    `Need to reschedule or cancel? Just reply to your confirmation email and we'll sort it out.`,
    ``,
    `— Chiibitsu Labs`,
  ].filter((l) => l !== null);

  return lines.join('\n');
}

const DEFAULT_EVENT_TITLE_TEMPLATE = '[{project}] {company} - {department}';

function renderEventTitle(
  template: string,
  vars: { project: string; company: string; department: string; booker: string },
): string {
  let result = vars.department ? template : template.replace(/\s*-\s*\{department\}/g, '');
  result = result
    .replace(/\{project\}/g, vars.project)
    .replace(/\{company\}/g, vars.company)
    .replace(/\{department\}/g, vars.department)
    .replace(/\{booker\}/g, vars.booker);
  return result;
}

export async function createBookingEvent(
  booking: BookingDetails,
  calendarId?: string,
  // Google emails the attendee its own invite independently of our Resend mail,
  // so suppressing "notify the client" has to reach this call too.
  opts: { notifyAttendee?: boolean } = {},
): Promise<{ eventId: string; eventLink: string }> {
  const notifyAttendee = opts.notifyAttendee ?? true;
  const calendar = getCalendarClient();
  const calId = calendarId ?? process.env.GOOGLE_CALENDAR_ID ?? 'primary';

  const zonedStart = toZonedTime(new Date(booking.startISO), TIMEZONE);
  const zonedEnd = toZonedTime(new Date(booking.endISO), TIMEZONE);

  // Build event title from the project's template (default: "[Project] Company - Department")
  const company =
    booking.customFields.company_name || booking.bookerCompany || booking.bookerName;
  const department = booking.customFields.department ?? '';
  const eventSummary = renderEventTitle(
    booking.calendarEventTitleTemplate || DEFAULT_EVENT_TITLE_TEMPLATE,
    { project: booking.projectName, company, department, booker: booking.bookerName },
  );

  const event = await calendar.events.insert({
    calendarId: calId,
    sendUpdates: notifyAttendee ? 'all' : 'none',
    requestBody: {
      summary: eventSummary,
      description: buildEventDescription(booking),
      start: {
        dateTime: booking.startISO,
        timeZone: TIMEZONE,
      },
      end: {
        dateTime: booking.endISO,
        timeZone: TIMEZONE,
      },
      // sendUpdates:'none' only suppresses Google's mail; an attendee still
      // gets the event on their own calendar. "Don't notify" must mean neither.
      attendees: notifyAttendee
        ? [{ email: booking.bookerEmail, displayName: booking.bookerName }]
        : [],
      extendedProperties: {
        private: {
          chiibitsuBooking: 'true',
          projectSlug: booking.projectSlug,
          bookerEmail: booking.bookerEmail,
          bookerName: booking.bookerName,
          bookerPhone: booking.bookerPhone ?? '',
          bookerCompany: booking.bookerCompany ?? '',
          customFields: JSON.stringify(booking.customFields),
        },
      },
    },
  });

  return {
    eventId: event.data.id ?? '',
    eventLink: event.data.htmlLink ?? '',
  };
}

export async function cancelBookingEvent(eventId: string, calendarId?: string): Promise<void> {
  const calendar = getCalendarClient();
  const calId = calendarId ?? process.env.GOOGLE_CALENDAR_ID ?? 'primary';
  await calendar.events.delete({ calendarId: calId, eventId, sendUpdates: 'all' });
}

export interface AdminBooking {
  eventId: string;
  /** Which calendar the event lives on — cancelling needs it. */
  calendarId: string;
  projectSlug: string;
  projectName: string;
  bookerName: string;
  bookerEmail: string;
  bookerPhone: string;
  bookerCompany: string;
  startISO: string;
  endISO: string;
  dateLabel: string;
  timeLabel: string;
  customFields: Record<string, string>;
}

export async function getUpcomingBookings(): Promise<AdminBooking[]> {
  const calendar = getCalendarClient();
  const defaultCalId = process.env.GOOGLE_CALENDAR_ID ?? 'primary';

  const { getProjects, getAllProjectsAdmin } = await import('@/lib/db');
  // The manual path can book a PAUSED project, so resolve calendars from the
  // admin list; getProjects filters to is_active and would hide those bookings.
  const adminList = await getAllProjectsAdmin().catch(() => []);
  const projectList = adminList.length > 0 ? adminList : await getProjects();

  // Bookings are created on the project's own calendar when it has one, so
  // listing only the default calendar would hide them from this list entirely.
  const calendarIds = Array.from(
    new Set([defaultCalId, ...projectList.map((p) => p.calendarId).filter(Boolean) as string[]]),
  );

  type Listed = { calId: string; e: calendar_v3.Schema$Event };
  const results = await Promise.all(
    calendarIds.map(async (calId): Promise<Listed[]> => {
      try {
        const r = await calendar.events.list({
          calendarId: calId,
          privateExtendedProperty: ['chiibitsuBooking=true'],
          timeMin: new Date().toISOString(),
          orderBy: 'startTime',
          singleEvents: true,
          maxResults: 100,
        });
        return (r.data.items ?? []).map((e) => ({ calId, e }));
      } catch (err) {
        // One unreachable calendar must not empty the whole list.
        console.error(`getUpcomingBookings: calendar ${calId} failed:`, err);
        return [];
      }
    }),
  );

  // 'primary' and the account's explicit address are distinct strings but the
  // same calendar, so the same event can arrive twice.
  const seenIds = new Set<string>();
  const events = results.flat().filter(({ e }) => {
    if (!e.id || seenIds.has(e.id)) return false;
    seenIds.add(e.id);
    return true;
  });

  return events
    .filter(({ e }) => e.start?.dateTime)
    .map(({ calId, e }) => {
      const props = e.extendedProperties?.private ?? {};
      const slug = props.projectSlug ?? '';
      const project = projectList.find((p) => p.slug === slug);
      const startUTC = new Date(e.start!.dateTime!);
      const zonedStart = toZonedTime(startUTC, TIMEZONE);

      let customFields: Record<string, string> = {};
      try {
        customFields = JSON.parse(props.customFields ?? '{}');
      } catch {
        customFields = {};
      }

      return {
        eventId: e.id ?? '',
        calendarId: calId,
        projectSlug: slug,
        projectName: project?.name ?? slug,
        bookerName: props.bookerName ?? '',
        bookerEmail: props.bookerEmail ?? '',
        bookerPhone: props.bookerPhone ?? '',
        bookerCompany: props.bookerCompany ?? '',
        startISO: e.start!.dateTime!,
        endISO: e.end?.dateTime ?? '',
        dateLabel: format(zonedStart, 'EEE, MMM d, yyyy'),
        timeLabel: format(zonedStart, 'h:mm a'),
        customFields,
      };
    })
    // Merged from several calendars, so each list's own ordering no longer
    // holds. Compare instants: the strings carry per-calendar UTC offsets.
    .sort((a, b) => new Date(a.startISO).getTime() - new Date(b.startISO).getTime());
}

/**
 * Existing events overlapping a window, on the calendar a booking would land on.
 * The manual admin path intentionally ignores slot templates, but silently
 * double-booking is a different thing from ignoring a template.
 */
export async function findConflicts(
  startISO: string,
  endISO: string,
  calendarId?: string,
): Promise<string[]> {
  const calendar = getCalendarClient();
  const calId = calendarId ?? process.env.GOOGLE_CALENDAR_ID ?? 'primary';
  try {
    const res = await calendar.events.list({
      calendarId: calId,
      timeMin: startISO,
      timeMax: endISO,
      singleEvents: true,
      maxResults: 10,
    });
    return (res.data.items ?? [])
      .filter((e) => e.start?.dateTime && e.transparency !== 'transparent')
      .map((e) => {
        const zoned = toZonedTime(new Date(e.start!.dateTime!), TIMEZONE);
        return `${e.summary ?? 'Untitled'} (${format(zoned, 'h:mm a')})`;
      });
  } catch (err) {
    // A freebusy failure must not block a booking the admin has decided on.
    console.error('findConflicts failed:', err);
    return [];
  }
}
