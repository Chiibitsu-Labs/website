import { NextRequest, NextResponse } from 'next/server';
import { getProject } from '@/config/projects';
import { createBookingEvent, getAvailableSlots } from '@/lib/google-calendar';
import { sendBookingConfirmationToBooker, sendBookingNotificationToAdmin } from '@/lib/email';

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

    const project = getProject(slug);
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

    // Fire emails concurrently, don't fail the booking if email fails
    await Promise.allSettled([
      sendBookingConfirmationToBooker(booking, project, eventLink),
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
