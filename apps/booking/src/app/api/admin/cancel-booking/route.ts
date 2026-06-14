import { NextRequest, NextResponse } from 'next/server';
import { cancelBookingEvent } from '@/lib/google-calendar';
import { sendSimpleMessage, hasTelegram } from '@/lib/telegram';

function checkAuth(req: NextRequest) {
  const password = req.headers.get('x-admin-password');
  const email = req.headers.get('x-admin-email');
  return (
    password === process.env.ADMIN_PASSWORD &&
    (!process.env.ADMIN_EMAIL || email === process.env.ADMIN_EMAIL)
  );
}

export async function DELETE(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { eventId, calendarId, bookerName, projectName, dateLabel } = body;

  if (!eventId) {
    return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
  }

  try {
    await cancelBookingEvent(eventId, calendarId);

    if (hasTelegram()) {
      const who = bookerName ? ` · ${bookerName}` : '';
      const what = projectName ? ` · ${projectName}` : '';
      const when = dateLabel ? ` · ${dateLabel}` : '';
      await sendSimpleMessage(
        `🚫 *Booking cancelled by admin*${what}${who}${when}`,
      ).catch(() => {});
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Cancel failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
