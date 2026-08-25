import { NextRequest, NextResponse } from 'next/server';
import { addMinutes } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import { createBookingEvent, findConflicts, getUpcomingBookings } from '@/lib/google-calendar';
import { sendBookingConfirmationToBooker } from '@/lib/email';
import { sendSimpleMessage, hasTelegram } from '@/lib/telegram';
import { getAllProjectsAdmin } from '@/lib/db';
import { checkAdminAuth } from '@/lib/admin-auth';
import { errorMessage } from '@/lib/utils';

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
      locationChoice, // "Online" | "Face to face" — optional override
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

    if (project.locationType === 'either' && !locationChoice) {
      return NextResponse.json(
        { error: 'This session can run online or face to face — say which.' },
        { status: 400 },
      );
    }

    const [hourStr, minuteStr] = String(time).split(':');
    const hour = Number(hourStr);
    const minute = Number(minuteStr ?? 0);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
      return NextResponse.json({ error: 'Invalid time. Use HH:MM.' }, { status: 400 });
    }

    // Interpret the admin's date/time as host-timezone wall clock, then store
    // the real UTC instant — same contract the slot generator uses.
    const wallClock = new Date(`${date}T00:00:00`);
    if (Number.isNaN(wallClock.getTime())) {
      return NextResponse.json({ error: 'Invalid date. Use YYYY-MM-DD.' }, { status: 400 });
    }
    wallClock.setHours(hour, minute, 0, 0);

    const startUTC = fromZonedTime(wallClock, TIMEZONE);
    const minutes = Number(durationMinutes) > 0 ? Number(durationMinutes) : project.durationMinutes;
    const endUTC = addMinutes(startUTC, minutes);

    const customFields: Record<string, string> = {};
    if (locationChoice) customFields.location_choice = locationChoice;
    if (bookerTimezone) customFields.booker_timezone = bookerTimezone;
    // Reserved key, filtered out of every client-facing surface.
    if (notes) customFields.admin_note = notes;

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
        `✍️ *Booking added manually*\n${project.name} · ${name}\n${date} ${time} (${minutes} min)` +
          (notes ? `\n📝 ${notes}` : '') +
          (sendEmail ? '' : '\n(client not notified)'),
      ).catch(() => {});
    }

    return NextResponse.json({ success: true, eventId, eventLink });
  } catch (err: unknown) {
    console.error('Manual booking error:', err);
    return NextResponse.json({ error: errorMessage(err, 'Failed to create booking') }, { status: 400 });
  }
}
