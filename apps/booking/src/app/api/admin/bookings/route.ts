import { NextRequest, NextResponse } from 'next/server';
import { getUpcomingBookings } from '@/lib/google-calendar';
import { checkAdminAuth } from '@/lib/admin-auth';

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
