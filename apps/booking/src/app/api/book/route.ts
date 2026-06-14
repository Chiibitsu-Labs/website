import { NextRequest, NextResponse } from 'next/server';
import { getProjectBySlug } from '@/lib/db';
import { createBookingEvent, getAvailableSlots, cancelBookingEvent } from '@/lib/google-calendar';
import {
  sendBookingConfirmationToBooker,
  sendBookingNotificationToAdmin,
  sendPendingBookingToBooker,
} from '@/lib/email';
import { createPendingToken } from '@/lib/pending-token';
import { verifyRescheduleToken } from '@/lib/reschedule-token';
import { sendApprovalRequest, hasTelegram } from '@/lib/telegram';
import { format, addDays, isBefore } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const TIMEZONE = process.env.NEXT_PUBLIC_TIMEZONE ?? 'Asia/Manila';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      slug,
      startISO,
      endISO,
      name,
      email,
      phone,
      company,
      customFields = {},
      rescheduleToken,
    } = body;

    // Validate reschedule token if provided
    let reschedulePayload = null;
    if (rescheduleToken) {
      reschedulePayload = verifyRescheduleToken(rescheduleToken);
      if (!reschedulePayload) {
        return NextResponse.json({ error: 'Invalid or expired reschedule link.' }, { status: 400 });
      }
      // Enforce 1-week-before rule
      if (!isBefore(addDays(new Date(), 7), new Date(reschedulePayload.originalStartISO))) {
        return NextResponse.json(
          { error: 'Reschedule window has closed. Bookings can only be rescheduled more than 7 days before the session.' },
          { status: 400 },
        );
      }
    }

    if (!slug || !startISO || !endISO || !name || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const project = await getProjectBySlug(slug);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Verify slot exists and isn't blocked by an existing Google Calendar event
    const dateStr = startISO.slice(0, 10);
    const slots = await getAvailableSlots(project, dateStr);
    const slot = slots.find((s) => s.startISO === startISO);

    if (!slot) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 400 });
    }

    if (!slot.available) {
      return NextResponse.json(
        { error: 'This slot is no longer available. Please choose another time.' },
        { status: 409 },
      );
    }

    const booking = {
      projectName: project.name,
      projectSlug: project.slug,
      company: project.company,
      bookerName: name,
      bookerEmail: email,
      bookerPhone: phone ?? '',
      bookerCompany: company ?? '',
      startISO,
      endISO,
      customFields,
    };

    // ── Pending approval via Telegram ─────────────────────────────────────────
    // When Telegram is configured, ALL bookings need Chii's approval before
    // the Google Calendar event is created. The slot stays open while pending.
    if (hasTelegram()) {
      const token = createPendingToken({
        projectSlug: slug,
        name,
        email,
        phone: phone ?? '',
        bookerCompany: company ?? '',
        startISO,
        endISO,
        customFields,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        rescheduleToken: rescheduleToken ?? undefined,
      });

      const zonedStart = toZonedTime(new Date(startISO), TIMEZONE);
      const zonedEnd = toZonedTime(new Date(endISO), TIMEZONE);
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? '';

      const originalDateLabel = reschedulePayload
        ? format(toZonedTime(new Date(reschedulePayload.originalStartISO), TIMEZONE), 'EEE, MMM d, yyyy h:mm a')
        : undefined;

      await sendApprovalRequest({
        bookingToken: token,
        bookerName: name,
        bookerEmail: email,
        bookerPhone: phone,
        bookerCompany: company,
        projectName: project.name,
        dateLabel: format(zonedStart, 'EEE, MMM d, yyyy'),
        timeLabel: format(zonedStart, 'h:mm a'),
        endLabel: format(zonedEnd, 'h:mm a'),
        customFields,
        baseUrl,
        isReschedule: !!reschedulePayload,
        originalDateLabel,
      });

      await sendPendingBookingToBooker(booking, project).catch(() => {});

      return NextResponse.json({
        success: true,
        pendingApproval: true,
        message: "Your booking request has been received. We'll confirm by email within 24 hours.",
      });
    }
    // ── End pending approval ──────────────────────────────────────────────────

    // Fallback: auto-confirm if Telegram is not configured
    const { eventId, eventLink } = await createBookingEvent(booking, project.calendarId);

    // If rescheduling, cancel the old event
    if (reschedulePayload) {
      await cancelBookingEvent(reschedulePayload.eventId, reschedulePayload.calendarId).catch(
        (e) => console.error('Failed to cancel old event during reschedule:', e),
      );
    }

    await Promise.allSettled([
      sendBookingConfirmationToBooker(booking, project, eventId, project.calendarId),
      sendBookingNotificationToAdmin(booking, project, eventLink),
    ]);

    return NextResponse.json({
      success: true,
      eventLink,
      booking: {
        projectName: project.name,
        company: project.company,
        name,
        email,
        startISO,
        endISO,
      },
    });
  } catch (err) {
    console.error('Booking error:', err);
    return NextResponse.json({ error: 'Booking failed. Please try again.' }, { status: 500 });
  }
}
