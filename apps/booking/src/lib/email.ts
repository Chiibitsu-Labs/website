import { Resend } from 'resend';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import type { BookingDetails } from './google-calendar';
import type { Project } from '@/config/projects';

const TIMEZONE = process.env.NEXT_PUBLIC_TIMEZONE ?? 'Asia/Manila';

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

function formatDateTime(isoString: string) {
  const zoned = toZonedTime(new Date(isoString), TIMEZONE);
  return {
    date: format(zoned, 'EEEE, MMMM d, yyyy'),
    time: format(zoned, 'h:mm a'),
    full: format(zoned, 'EEEE, MMMM d, yyyy \'at\' h:mm a'),
  };
}

export async function sendBookingConfirmationToBooker(
  booking: BookingDetails,
  project: Project,
  eventLink: string,
) {
  const resend = getResend();
  const from = formatDateTime(booking.startISO);
  const to = formatDateTime(booking.endISO);

  const customFieldsHtml = Object.entries(booking.customFields)
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="padding:4px 8px;color:#6b7280;font-size:14px;">${k}</td><td style="padding:4px 8px;font-size:14px;">${v}</td></tr>`)
    .join('');

  await resend.emails.send({
    from: process.env.EMAIL_FROM ?? 'booking@chiibitsu.com',
    to: booking.bookerEmail,
    subject: `Booking confirmed: ${project.name}`,
    html: `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;background:#f9fafb;margin:0;padding:32px 16px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:32px;text-align:center;">
      <p style="margin:0;color:rgba(255,255,255,0.8);font-size:13px;letter-spacing:0.05em;text-transform:uppercase;">Chiibitsu Labs</p>
      <h1 style="margin:8px 0 0;color:#fff;font-size:24px;font-weight:700;">You're booked! ✓</h1>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 4px;font-size:18px;font-weight:600;color:#111827;">${project.name}</h2>
      <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">${project.company}</p>

      <div style="background:#f3f4f6;border-radius:12px;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>📅 Date</strong><br>${from.date}</p>
        <p style="margin:0;font-size:14px;color:#374151;"><strong>🕐 Time</strong><br>${from.time} – ${to.time}</p>
      </div>

      <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#111827;">Your details</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr><td style="padding:4px 8px;color:#6b7280;font-size:14px;">Name</td><td style="padding:4px 8px;font-size:14px;">${booking.bookerName}</td></tr>
        <tr><td style="padding:4px 8px;color:#6b7280;font-size:14px;">Email</td><td style="padding:4px 8px;font-size:14px;">${booking.bookerEmail}</td></tr>
        ${booking.bookerPhone ? `<tr><td style="padding:4px 8px;color:#6b7280;font-size:14px;">Phone</td><td style="padding:4px 8px;font-size:14px;">${booking.bookerPhone}</td></tr>` : ''}
        ${booking.bookerCompany ? `<tr><td style="padding:4px 8px;color:#6b7280;font-size:14px;">Company</td><td style="padding:4px 8px;font-size:14px;">${booking.bookerCompany}</td></tr>` : ''}
        ${customFieldsHtml}
      </table>

      ${eventLink ? `<a href="${eventLink}" style="display:inline-block;padding:12px 24px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">Add to Google Calendar</a>` : ''}

      <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;">If you need to reschedule or cancel, just reply to this email.</p>
    </div>
  </div>
</body>
</html>
    `,
  });
}

export async function sendPendingBookingToBooker(
  booking: BookingDetails,
  project: Project,
) {
  const resend = getResend();
  const from = formatDateTime(booking.startISO);
  const to = formatDateTime(booking.endISO);

  await resend.emails.send({
    from: process.env.EMAIL_FROM ?? 'booking@chiibitsu.com',
    to: booking.bookerEmail,
    subject: `Booking request received: ${project.name}`,
    html: `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;background:#f9fafb;margin:0;padding:32px 16px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:32px;text-align:center;">
      <p style="margin:0;color:rgba(255,255,255,0.8);font-size:13px;letter-spacing:0.05em;text-transform:uppercase;">Chiibitsu Labs</p>
      <h1 style="margin:8px 0 0;color:#fff;font-size:24px;font-weight:700;">Request received ⏳</h1>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 4px;font-size:18px;font-weight:600;color:#111827;">${project.name}</h2>
      <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">${project.company}</p>
      <div style="background:#f3f4f6;border-radius:12px;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>📅 Date</strong><br>${from.date}</p>
        <p style="margin:0;font-size:14px;color:#374151;"><strong>🕐 Time</strong><br>${from.time} – ${to.time}</p>
      </div>
      <p style="font-size:14px;color:#374151;">Hi <strong>${booking.bookerName}</strong>,</p>
      <p style="font-size:14px;color:#374151;">Your booking request has been received and is being reviewed by Chiibitsu Labs.</p>
      <p style="font-size:14px;color:#374151;">You'll hear back within <strong>24 hours</strong>. If confirmed, you'll get a full confirmation email with a calendar invite.</p>
      <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;">Questions? Reply to this email.</p>
    </div>
  </div>
</body>
</html>`,
  });
}

export async function sendApprovalConfirmation(
  booking: BookingDetails,
  project: Project,
  eventLink: string,
) {
  const resend = getResend();
  const from = formatDateTime(booking.startISO);
  const to = formatDateTime(booking.endISO);

  await resend.emails.send({
    from: process.env.EMAIL_FROM ?? 'booking@chiibitsu.com',
    to: booking.bookerEmail,
    subject: `Booking confirmed: ${project.name}`,
    html: `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;background:#f9fafb;margin:0;padding:32px 16px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#16a34a,#15803d);padding:32px;text-align:center;">
      <p style="margin:0;color:rgba(255,255,255,0.8);font-size:13px;letter-spacing:0.05em;text-transform:uppercase;">Chiibitsu Labs</p>
      <h1 style="margin:8px 0 0;color:#fff;font-size:24px;font-weight:700;">You're confirmed! ✓</h1>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 4px;font-size:18px;font-weight:600;color:#111827;">${project.name}</h2>
      <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">${project.company}</p>
      <div style="background:#f3f4f6;border-radius:12px;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>📅 Date</strong><br>${from.date}</p>
        <p style="margin:0;font-size:14px;color:#374151;"><strong>🕐 Time</strong><br>${from.time} – ${to.time}</p>
      </div>
      <p style="font-size:14px;color:#374151;">Great news, <strong>${booking.bookerName}</strong>! Your booking has been confirmed by Chiibitsu Labs.</p>
      ${eventLink ? `<a href="${eventLink}" style="display:inline-block;margin-top:8px;padding:12px 24px;background:#16a34a;color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">Add to Google Calendar</a>` : ''}
      <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;">If you need to reschedule or cancel, just reply to this email.</p>
    </div>
  </div>
</body>
</html>`,
  });
}

export async function sendRejectionEmail(
  booking: BookingDetails,
  project: Project,
) {
  const resend = getResend();
  const from = formatDateTime(booking.startISO);
  const to = formatDateTime(booking.endISO);

  await resend.emails.send({
    from: process.env.EMAIL_FROM ?? 'booking@chiibitsu.com',
    to: booking.bookerEmail,
    subject: `Re: Your booking request — ${project.name}`,
    html: `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;background:#f9fafb;margin:0;padding:32px 16px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="background:#6b7280;padding:32px;text-align:center;">
      <p style="margin:0;color:rgba(255,255,255,0.8);font-size:13px;letter-spacing:0.05em;text-transform:uppercase;">Chiibitsu Labs</p>
      <h1 style="margin:8px 0 0;color:#fff;font-size:24px;font-weight:700;">Booking not confirmed</h1>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 4px;font-size:18px;font-weight:600;color:#111827;">${project.name}</h2>
      <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">${project.company}</p>
      <div style="background:#f3f4f6;border-radius:12px;padding:20px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>📅 Date requested</strong><br>${from.date}</p>
        <p style="margin:0;font-size:14px;color:#374151;"><strong>🕐 Time</strong><br>${from.time} – ${to.time}</p>
      </div>
      <p style="font-size:14px;color:#374151;">Hi <strong>${booking.bookerName}</strong>,</p>
      <p style="font-size:14px;color:#374151;">Unfortunately we're unable to confirm this booking. You're welcome to pick a different date — we'd love to find a time that works!</p>
      <p style="font-size:14px;"><a href="${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/${project.slug}" style="color:#4f46e5;">Book another date →</a></p>
      <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;">Questions? Just reply to this email.</p>
    </div>
  </div>
</body>
</html>`,
  });
}

export async function sendBookingNotificationToAdmin(
  booking: BookingDetails,
  project: Project,
  eventLink: string,
) {
  const resend = getResend();
  const adminEmail = process.env.ADMIN_EMAIL ?? 'chii@chiibitsu.com';
  const from = formatDateTime(booking.startISO);
  const to = formatDateTime(booking.endISO);

  const customFieldsText = Object.entries(booking.customFields)
    .filter(([, v]) => v)
    .map(([k, v]) => `• ${k}: ${v}`)
    .join('\n');

  await resend.emails.send({
    from: process.env.EMAIL_FROM ?? 'booking@chiibitsu.com',
    to: adminEmail,
    subject: `New booking: ${project.name} — ${booking.bookerName}`,
    html: `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;background:#f9fafb;margin:0;padding:32px 16px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="background:#111827;padding:24px 32px;">
      <p style="margin:0;color:#9ca3af;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;">New Booking Alert</p>
      <h1 style="margin:4px 0 0;color:#fff;font-size:20px;font-weight:700;">${booking.bookerName}</h1>
      <p style="margin:2px 0 0;color:#6b7280;font-size:14px;">${booking.bookerEmail}</p>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 4px;font-size:15px;font-weight:600;color:#111827;">${project.name}</p>
      <p style="margin:0 0 20px;color:#6b7280;font-size:13px;">${project.company}</p>

      <div style="background:#f3f4f6;border-radius:10px;padding:16px;margin-bottom:20px;">
        <p style="margin:0;font-size:14px;color:#374151;">${from.date}<br><strong>${from.time} – ${to.time}</strong></p>
      </div>

      ${booking.bookerPhone ? `<p style="margin:0 0 4px;font-size:14px;color:#374151;">📱 ${booking.bookerPhone}</p>` : ''}
      ${booking.bookerCompany ? `<p style="margin:0 0 4px;font-size:14px;color:#374151;">🏢 ${booking.bookerCompany}</p>` : ''}
      ${customFieldsText ? `<pre style="margin:16px 0 0;font-size:13px;color:#374151;background:#f9fafb;padding:12px;border-radius:8px;white-space:pre-wrap;">${customFieldsText}</pre>` : ''}

      ${eventLink ? `<a href="${eventLink}" style="display:inline-block;margin-top:20px;padding:10px 20px;background:#111827;color:#fff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;">View in Google Calendar →</a>` : ''}
    </div>
  </div>
</body>
</html>
    `,
  });
}
