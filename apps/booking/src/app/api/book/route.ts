import { NextRequest, NextResponse } from 'next/server';
import { resolveProjectForSlug, rescheduleTokenMatchesProject } from '@/lib/db';
import { createBookingEvent, getAvailableSlots, cancelBookingEvent } from '@/lib/google-calendar';
import {
  sendBookingConfirmationToBooker,
  sendBookingNotificationToAdmin,
  sendPendingBookingToBooker,
} from '@/lib/email';
import { createPendingToken } from '@/lib/pending-token';
import { verifyRescheduleToken } from '@/lib/reschedule-token';
import { sendApprovalRequest, hasTelegram } from '@/lib/telegram';
import { LOCATION_CHOICES, isLocationChoice } from '@/lib/location';
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
      // The token must name the project being booked. Otherwise a token for one
      // project would authorise a booking on any other — including a paused one
      // via the branch below — and, worse, cancel the unrelated event this
      // token does point at once the new booking is confirmed.
      if (!rescheduleTokenMatchesProject(reschedulePayload, slug)) {
        return NextResponse.json(
          { error: 'That reschedule link is for a different session.' },
          { status: 400 },
        );
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

    // A valid reschedule token for THIS project is proof the person was already
    // booked on it, so a pause must not strand them mid-reschedule.
    const project = await resolveProjectForSlug(slug, reschedulePayload);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // BookingFlow requires this choice, but client-side validation is not a
    // guarantee — and the admin route already enforces it, so accepting it here
    // would let the same input land as "format to be confirmed" via one path
    // and be rejected by the other.
    const projectFieldIds = project.customFields.map((f) => f.id);
    const locationIsReserved = !projectFieldIds.includes('location_choice');

    if (locationIsReserved && customFields.location_choice && !isLocationChoice(customFields.location_choice)) {
      return NextResponse.json(
        { error: `Location must be one of: ${LOCATION_CHOICES.join(', ')}.` },
        { status: 400 },
      );
    }

    if (locationIsReserved && project.locationType === 'either' && !customFields.location_choice) {
      return NextResponse.json(
        { error: 'Please choose whether you would like to meet online or face to face.' },
        { status: 400 },
      );
    }

    /**
     * `location_choice` decides client-facing copy ("we'll send the joining
     * link" vs "we'll confirm the venue"), and describeLocation honours it on
     * ANY project so the admin can book one online client against a
     * face-to-face project. That makes provenance matter: the value is only
     * trustworthy when WE recorded it.
     *
     * Only two sources qualify. On an 'either' project the booker was actually
     * asked, so their submission is the answer. Otherwise the form never
     * offered the choice, so anything posted under that key is spoofed or a
     * stale prefill — but the reschedule token is HMAC-signed by us, so a
     * choice carried inside it is our own earlier decision and must survive the
     * reschedule rather than silently reverting to the project default.
     */
    if (locationIsReserved && project.locationType !== 'either') {
      const carriedOver = reschedulePayload?.customFields?.location_choice;
      if (isLocationChoice(carriedOver)) {
        customFields.location_choice = carriedOver;
      } else {
        delete customFields.location_choice;
      }
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
      calendarEventTitleTemplate: project.calendarEventTitleTemplate,
      projectDescription: project.description,
      locationType: project.locationType,
      projectFieldIds,
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
