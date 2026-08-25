import { NextRequest, NextResponse } from 'next/server';
import { addMinutes } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import { createBookingEvent, findConflicts, getUpcomingBookings } from '@/lib/google-calendar';
import { sendBookingConfirmationToBooker } from '@/lib/email';
import { sendSimpleMessage, hasTelegram, escapeMarkdown } from '@/lib/telegram';
import { getAllProjectsAdmin } from '@/lib/db';
import { checkAdminAuth } from '@/lib/admin-auth';
import { errorMessage } from '@/lib/utils';
import { LOCATION_CHOICES, isLocationChoice } from '@/lib/location';

const TIMEZONE = process.env.NEXT_PUBLIC_TIMEZONE ?? 'Asia/Manila';

export async function GET(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const bookings = await getUpcomingBookings();
    return NextResponse.json({ bookings });
  } catch (err) {
    console.error('Admin bookings error:', err);
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 });
  }
}

/**
 * Create a booking by hand, from the admin panel.
 *
 * The public flow can only book times the project's slot templates generate.
 * Real clients negotiate — they ask for noon instead of 1pm, or a different
 * length — and that agreement has to land in the system like any other booking
 * rather than as a calendar entry the admin list cannot see. This deliberately
 * skips slot-template validation: the admin has already decided the time.
 */
export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      slug,
      name,
      email,
      phone = '',
      company = '',
      date,           // "2026-08-26" — wall-clock date in the host timezone
      time,           // "12:00" — 24h wall-clock start in the host timezone
      durationMinutes,
      locationChoice, // "Online" | "Face to face" — per-booking override,
                      // valid for ANY project, not just 'either' ones
      bookerTimezone, // IANA id, so the confirmation email shows their local time
      notes = '',     // internal: never rendered to the client
      sendEmail = true,
      allowConflict = false,
    } = body;

    if (!slug || !name || !email || !date || !time) {
      return NextResponse.json(
        { error: 'Project, name, email, date and time are all required.' },
        { status: 400 },
      );
    }

    // Resolve against the admin list, not getProjectBySlug: that filters to
    // is_active and falls back to hard-coded SEED_PROJECTS, so booking a paused
    // project would 404 — or worse, silently use seed config (wrong calendar,
    // duration and title) for the two seed slugs.
    const project = (await getAllProjectsAdmin()).find((p) => p.slug === slug);
    if (!project) {
      return NextResponse.json({ error: `No project found for "${slug}".` }, { status: 404 });
    }

    if (locationChoice && !isLocationChoice(locationChoice)) {
      return NextResponse.json(
        { error: `Location must be one of: ${LOCATION_CHOICES.join(', ')}.` },
        { status: 400 },
      );
    }

    if (project.locationType === 'either' && !locationChoice) {
      return NextResponse.json(
        { error: 'This session can run online or face to face — say which.' },
        { status: 400 },
      );
    }

    const [hourStr, minuteStr] = String(time).split(':');
    const hour = Number(hourStr);
    const minute = Number(minuteStr ?? 0);
    // Range-check explicitly: setHours(25, …) silently rolls into the next day,
    // so a typo would book a different date than the one on screen.
    if (
      !Number.isInteger(hour) || hour < 0 || hour > 23 ||
      !Number.isInteger(minute) || minute < 0 || minute > 59
    ) {
      return NextResponse.json(
        { error: 'Invalid time. Use HH:MM between 00:00 and 23:59.' },
        { status: 400 },
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      return NextResponse.json({ error: 'Invalid date. Use YYYY-MM-DD.' }, { status: 400 });
    }

    // Hand fromZonedTime the wall-clock STRING rather than a Date. Building a
    // Date first reads its fields in the machine's own zone, so the same input
    // resolved differently on a UTC server and in the admin's browser preview
    // around a DST boundary. A string has no such ambiguity.
    const pad = (n: number) => String(n).padStart(2, '0');
    const startUTC = fromZonedTime(`${date}T${pad(hour)}:${pad(minute)}:00`, TIMEZONE);
    if (Number.isNaN(startUTC.getTime())) {
      return NextResponse.json({ error: 'Invalid date or time.' }, { status: 400 });
    }
    const minutes = Number(durationMinutes) > 0 ? Number(durationMinutes) : project.durationMinutes;
    const endUTC = addMinutes(startUTC, minutes);

    // A mistyped past date would still create a real invite and email, but
    // getUpcomingBookings lists from now onwards — so it could never be found
    // or cancelled from the panel afterwards.
    if (startUTC.getTime() < Date.now()) {
      return NextResponse.json(
        { error: 'That start time is in the past. Bookings must be in the future.' },
        { status: 400 },
      );
    }

    const customFields: Record<string, string> = {};
    if (locationChoice) customFields.location_choice = locationChoice;
    if (bookerTimezone) customFields.booker_timezone = bookerTimezone;
    // Reserved key, filtered out of every client-facing surface.
    // Google caps extendedProperties.private values, and every custom field
    // shares one serialised value — an unbounded note would 400 events.insert.
    if (notes) customFields.admin_note = String(notes).slice(0, 500);

    const booking = {
      projectName: project.name,
      projectSlug: project.slug,
      company: project.company,
      bookerName: name,
      bookerEmail: email,
      bookerPhone: phone,
      bookerCompany: company,
      startISO: startUTC.toISOString(),
      endISO: endUTC.toISOString(),
      customFields,
      calendarEventTitleTemplate: project.calendarEventTitleTemplate,
      projectDescription: project.description,
      locationType: project.locationType,
      projectFieldIds: project.customFields.map((f) => f.id),
    };

    // Ignoring the slot template is intended; silently double-booking is not.
    if (!allowConflict) {
      const conflicts = await findConflicts(
        booking.startISO,
        booking.endISO,
        project.calendarId,
      );
      if (conflicts.length > 0) {
        return NextResponse.json(
          {
            error: `That window already has: ${conflicts.join(', ')}.`,
            conflict: true,
          },
          { status: 409 },
        );
      }
    }

    const { eventId, eventLink } = await createBookingEvent(booking, project.calendarId, {
      // Google sends the attendee its own invite; "don't notify" must cover it.
      notifyAttendee: sendEmail,
    });

    if (sendEmail) {
      await sendBookingConfirmationToBooker(booking, project, eventId, project.calendarId).catch(
        (e) => console.error('Manual booking: confirmation email failed:', e),
      );
    }

    if (hasTelegram()) {
      await sendSimpleMessage(
        `✍️ *Booking added manually*\n${escapeMarkdown(project.name)} · ${escapeMarkdown(String(name))}\n${date} ${time} (${minutes} min)` +
          (customFields.admin_note ? `\n📝 ${escapeMarkdown(customFields.admin_note)}` : '') +
          (sendEmail ? '' : '\n(client not notified)'),
      ).catch(() => {});
    }

    return NextResponse.json({ success: true, eventId, eventLink });
  } catch (err: unknown) {
    console.error('Manual booking error:', err);
    return NextResponse.json({ error: errorMessage(err, 'Failed to create booking') }, { status: 400 });
  }
}
