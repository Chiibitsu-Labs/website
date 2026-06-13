import { NextRequest, NextResponse } from 'next/server';
import { getProjectBySlug } from '@/lib/db';
import { getAvailableSlots } from '@/lib/google-calendar';
import { parseISO, isValid, isBefore, startOfDay, addWeeks } from 'date-fns';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const slug = searchParams.get('slug');
  const date = searchParams.get('date');

  if (!slug || !date) {
    return NextResponse.json({ error: 'Missing slug or date' }, { status: 400 });
  }

  const project = await getProjectBySlug(slug);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const parsedDate = parseISO(date);
  if (!isValid(parsedDate)) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  }

  const today = startOfDay(new Date());
  const maxDate = addWeeks(today, project.bookingWindowWeeks);

  if (isBefore(parsedDate, today)) {
    return NextResponse.json({ slots: [] });
  }

  if (isBefore(maxDate, parsedDate)) {
    return NextResponse.json({ slots: [] });
  }

  try {
    const slots = await getAvailableSlots(project, date);
    return NextResponse.json({ slots });
  } catch (err) {
    console.error('Availability error:', err);
    return NextResponse.json({ error: 'Failed to fetch availability' }, { status: 500 });
  }
}
