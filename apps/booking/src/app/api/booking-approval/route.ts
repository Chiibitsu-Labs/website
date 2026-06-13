import { NextRequest, NextResponse } from 'next/server';
import { verifyPendingToken } from '@/lib/pending-token';
import { getProjectBySlug } from '@/lib/db';
import { createBookingEvent } from '@/lib/google-calendar';
import {
  sendApprovalConfirmation,
  sendRejectionEmail,
  sendBookingNotificationToAdmin,
} from '@/lib/email';
import { SEED_PROJECTS } from '@/config/projects';

function page(icon: string, heading: string, body: string) {
  return new NextResponse(
    `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${heading} — Chiibitsu Labs</title>
</head>
<body style="font-family:system-ui,sans-serif;background:#f9fafb;margin:0;padding:32px 16px;display:flex;align-items:center;justify-content:center;min-height:100vh;">
  <div style="max-width:480px;background:#fff;border-radius:16px;padding:40px 32px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="font-size:52px;margin-bottom:16px;">${icon}</div>
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#111827;">${heading}</h1>
    <p style="margin:0;font-size:15px;color:#6b7280;line-height:1.6;">${body}</p>
    <p style="margin:28px 0 0;font-size:12px;color:#d1d5db;">Chiibitsu Labs · Booking System</p>
  </div>
</body>
</html>`,
    { status: 200, headers: { 'Content-Type': 'text/html' } },
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const token = searchParams.get('token');
  const action = searchParams.get('action');

  if (!token || (action !== 'approve' && action !== 'reject')) {
    return page('⚠️', 'Invalid link', 'This link is missing required parameters.');
  }

  const payload = verifyPendingToken(token);
  if (!payload) {
    return page(
      '⏱️',
      'Link expired',
      'This approval link has expired (links are valid for 7 days) or is invalid. Check if the booking was already handled.',
    );
  }

  const project =
    (await getProjectBySlug(payload.projectSlug)) ??
    SEED_PROJECTS.find((p) => p.slug === payload.projectSlug) ??
    null;
  if (!project) {
    return page('❓', 'Project not found', 'Could not find the project for this booking.');
  }

  const booking = {
    projectName: project.name,
    projectSlug: project.slug,
    company: project.company,
    bookerName: payload.name,
    bookerEmail: payload.email,
    bookerPhone: payload.phone,
    bookerCompany: payload.bookerCompany,
    startISO: payload.startISO,
    endISO: payload.endISO,
    customFields: payload.customFields,
  };

  if (action === 'reject') {
    await sendRejectionEmail(booking, project).catch(() => {});
    return page(
      '❌',
      'Booking rejected',
      `You've declined the booking for <strong>${payload.name}</strong>. A rejection email has been sent to ${payload.email}.`,
    );
  }

  // Approve: create the Google Calendar event
  try {
    const { eventLink } = await createBookingEvent(booking, project.calendarId);
    await Promise.allSettled([
      sendApprovalConfirmation(booking, project, eventLink),
      sendBookingNotificationToAdmin(booking, project, eventLink),
    ]);
    return page(
      '✅',
      'Booking approved!',
      `The slot for <strong>${payload.name}</strong> is confirmed. A confirmation email has been sent to ${payload.email}.`,
    );
  } catch (err) {
    console.error('Approval booking error:', err);
    return page(
      '⚠️',
      'Something went wrong',
      'The booking could not be created. The slot may have already been taken. Please check your Google Calendar.',
    );
  }
}
