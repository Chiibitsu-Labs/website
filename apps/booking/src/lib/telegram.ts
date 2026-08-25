export function hasTelegram(): boolean {
  return !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

/**
 * Escape user-supplied text before interpolating it into a Markdown payload.
 * An unescaped `_` or `*` in a client name or note makes Telegram reject the
 * whole message with a 400 — and since fetch resolves on 4xx, the failure is
 * swallowed and the notification is simply lost.
 */
export function escapeMarkdown(text: string): string {
  return text.replace(/([_*[\]`])/g, '\\$1');
}

export async function sendSimpleMessage(text: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return;

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  }).catch((e) => {
    console.error('Telegram sendSimpleMessage error:', e);
    return null;
  });

  // fetch only rejects on network failure, so a rejected payload is otherwise silent.
  if (res && !res.ok) {
    console.error(
      'Telegram sendSimpleMessage rejected:',
      res.status,
      await res.text().catch(() => ''),
    );
  }
}

export async function sendApprovalRequest({
  bookingToken,
  bookerName,
  bookerEmail,
  bookerPhone,
  bookerCompany,
  projectName,
  dateLabel,
  timeLabel,
  endLabel,
  customFields,
  baseUrl,
  isReschedule,
  originalDateLabel,
}: {
  bookingToken: string;
  bookerName: string;
  bookerEmail: string;
  bookerPhone?: string;
  bookerCompany?: string;
  projectName: string;
  dateLabel: string;
  timeLabel: string;
  endLabel: string;
  customFields: Record<string, string>;
  baseUrl: string;
  isReschedule?: boolean;
  originalDateLabel?: string;
}) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return;

  const approveUrl = `${baseUrl}/api/booking-approval?token=${encodeURIComponent(bookingToken)}&action=approve`;
  const rejectUrl = `${baseUrl}/api/booking-approval?token=${encodeURIComponent(bookingToken)}&action=reject`;

  const extraLines = [
    bookerPhone ? `📱 ${bookerPhone}` : null,
    bookerCompany ? `🏢 ${bookerCompany}` : null,
    ...Object.entries(customFields)
      .filter(([, v]) => v)
      .map(([k, v]) => `• ${k}: ${v}`),
  ]
    .filter(Boolean)
    .join('\n');

  const header = isReschedule
    ? `🔄 *Reschedule request — approval needed*`
    : `⏳ *New booking — approval needed*`;

  const dateSection = isReschedule && originalDateLabel
    ? `📅 *New date:* ${dateLabel}\n↩️ *Was:* ${originalDateLabel}`
    : `📅 ${dateLabel}`;

  const text =
    `${header}\n\n` +
    `📌 ${projectName}\n` +
    `${dateSection}\n` +
    `🕐 ${timeLabel} – ${endLabel}\n\n` +
    `👤 ${bookerName}\n` +
    `📧 ${bookerEmail}` +
    (extraLines ? `\n${extraLines}` : '') +
    `\n\n_Tap below to approve or reject._`;

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ Approve', url: approveUrl },
          { text: '❌ Reject', url: rejectUrl },
        ]],
      },
    }),
  });
}
