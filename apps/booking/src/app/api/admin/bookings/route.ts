import { NextRequest, NextResponse } from 'next/server';
import { getUpcomingBookings } from '@/lib/google-calendar';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const password = searchParams.get('password');

  if (password !== process.env.ADMIN_PASSWORD) {
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
