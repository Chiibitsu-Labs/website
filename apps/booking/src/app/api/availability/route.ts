import { NextRequest, NextResponse } from 'next/server';
import { getProjectBySlug, getProjectBySlugIncludingPaused } from '@/lib/db';
import { getAvailableSlots } from '@/lib/google-calendar';
import { verifyRescheduleToken } from '@/lib/reschedule-token';
import { parseISO, isValid, isBefore, startOfDay, addWeeks } from 'date-fns';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const slug = searchParams.get('slug');
  const date = searchParams.get('date');
  const rescheduleToken = searchParams.get('reschedule');

  if (!slug || !date) {
    return NextResponse.json({ error: 'Missing slug or date' }, { status: 400 });
  }

  // The page and /api/book already let a valid token holder through to a paused
  // project; this endpoint feeds the picker between them, so leaving it
  // active-only made the reschedule page load and then show "No slots
  // available" on every date — visibly working, actually a dead end.
  // The token names its own project, so require the match: otherwise any live
  // token would expose availability for any paused project.
  const payload = rescheduleToken ? verifyRescheduleToken(rescheduleToken) : null;
  const isReschedulingThisProject = payload?.projectSlug === slug;

  const project = isReschedulingThisProject
    ? await getProjectBySlugIncludingPaused(slug)
    : await getProjectBySlug(slug);
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
