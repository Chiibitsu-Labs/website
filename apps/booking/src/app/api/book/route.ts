import { NextRequest, NextResponse } from 'next/server';
import { getProjectBySlug } from '@/lib/db';
import { createBookingEvent, getAvailableSlots } from '@/lib/google-calendar';
import { sendBookingConfirmationToBooker, sendBookingNotificationToAdmin } from '@/lib/email';
import { sendAfternoonAlert, hasTelegram } from '@/lib/telegram';
import { format } from 'date-fns';
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
    } = body;

    if (!slug || !startISO || !endISO || !name || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const project = await getProjectBySlug(slug);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Re-verify the slot is still available
    const dateStr = startISO.slice(0, 10);
    const slots = await getAvailableSlots(project, dateStr);
    const slot = slots.find((s) => s.startISO === startISO);

    if (!slot) {
      return NextResponse.json({ error: 'Slot not found' }, { status: 400 });
    }

    if (!slot.available) {
      return NextResponse.json({ error: 'This slot is no longer available. Please choose another time.' }, { status: 409 });
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

    const { eventLink } = await createBookingEvent(booking, project.calendarId);

    await Promise.allSettled([
      sendBookingConfirmationToBooker(booking, project, eventLink),
      sendBookingNotificationToAdmin(booking, project, eventLink),
    ]);

    // ── Afternoon alert to Chii ───────────────────────────────────────────────
    // If the project flags afternoon slots, check if morning was already taken.
    // If so, send a Telegram heads-up (booking is already confirmed above).
    if (project.afternoonRequiresApproval && hasTelegram()) {
      const utcHour = new Date(startISO).getUTCHours();
      const manilaHour = (utcHour + 8) % 24;

      if (manilaHour >= 12) {
        const morningBooked = slots.some((s) => {
          const sHour = (new Date(s.startISO).getUTCHours() + 8) % 24;
          return sHour < 12 && !s.available;
        });

        if (morningBooked) {
          const zonedStart = toZonedTime(new Date(startISO), TIMEZONE);
          const zonedEnd = toZonedTime(new Date(endISO), TIMEZONE);
          sendAfternoonAlert({
            bookerName: name,
            bookerEmail: email,
            bookerPhone: phone,
            bookerCompany: company,
            projectName: project.name,
            dateLabel: format(zonedStart, 'EEE, MMM d, yyyy'),
            timeLabel: format(zonedStart, 'h:mm a'),
            endLabel: format(zonedEnd, 'h:mm a'),
            customFields,
            eventLink,
          }).catch(() => {});
        }
      }
    }
    // ── End afternoon alert ───────────────────────────────────────────────────

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
