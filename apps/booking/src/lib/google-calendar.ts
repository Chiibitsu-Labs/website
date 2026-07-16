import { google } from 'googleapis';
import { addMinutes, format, parseISO, startOfDay, endOfDay, differenceInMinutes } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import type { Project, TimeSlotTemplate } from '@/config/projects';
import { formatDuration } from './utils';

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
  locationType?: 'online' | 'in_person';
}

// Turn a custom-field id into a readable label, e.g. "company_name" → "Company name".
function prettifyKey(key: string): string {
  const spaced = key.replace(/[_-]+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// Warm, client-facing invite body. The booker is an attendee, so this is what
// they read inside their calendar — keep it professional and reassuring.
function buildEventDescription(booking: BookingDetails): string {
  const zonedStart = toZonedTime(new Date(booking.startISO), TIMEZONE);
  const zonedEnd = toZonedTime(new Date(booking.endISO), TIMEZONE);
  const durationLabel = formatDuration(
    differenceInMinutes(new Date(booking.endISO), new Date(booking.startISO)),
  );

  const locationLine =
    booking.locationType === 'in_person'
      ? '📍 In person — we\'ll confirm the exact venue with you'
      : '💻 Online — we\'ll send the joining link before we start';

  const detailRows = [
    `Name: ${booking.bookerName}`,
    `Email: ${booking.bookerEmail}`,
    booking.bookerPhone ? `Phone: ${booking.bookerPhone}` : null,
    booking.bookerCompany ? `Company: ${booking.bookerCompany}` : null,
    ...Object.entries(booking.customFields)
      .filter(([, v]) => v)
      .map(([k, v]) => `${prettifyKey(k)}: ${v}`),
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
): Promise<{ eventId: string; eventLink: string }> {
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
    sendUpdates: 'all',
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
      attendees: [{ email: booking.bookerEmail, displayName: booking.bookerName }],
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
  const calId = process.env.GOOGLE_CALENDAR_ID ?? 'primary';

  const res = await calendar.events.list({
    calendarId: calId,
    privateExtendedProperty: ['chiibitsuBooking=true'],
    timeMin: new Date().toISOString(),
    orderBy: 'startTime',
    singleEvents: true,
    maxResults: 100,
  });

  const events = res.data.items ?? [];
  const { getProjects } = await import('@/lib/db');
  const projectList = await getProjects();

  return events
    .filter((e) => e.start?.dateTime)
    .map((e) => {
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
    });
}
