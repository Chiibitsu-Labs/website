import { NextRequest, NextResponse } from 'next/server';
import { getUpcomingBookings } from '@/lib/google-calendar';

function checkAuth(req: NextRequest) {
  const password = req.headers.get('x-admin-password') ?? req.nextUrl.searchParams.get('password');
  const email = req.headers.get('x-admin-email') ?? req.nextUrl.searchParams.get('email');
  const validPassword = password === process.env.ADMIN_PASSWORD;
  const validEmail = !process.env.ADMIN_EMAIL || email === process.env.ADMIN_EMAIL;
  return validPassword && validEmail;
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
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
