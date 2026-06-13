export function hasTelegram(): boolean {
  return !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
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

  const text =
    `⏳ *Afternoon booking needs your approval*\n\n` +
    `📌 ${projectName}\n` +
    `📅 ${dateLabel}\n` +
    `🕐 ${timeLabel} – ${endLabel}\n\n` +
    `👤 ${bookerName}\n` +
    `📧 ${bookerEmail}` +
    (extraLines ? `\n${extraLines}` : '') +
    `\n\n_Morning slot already booked on this day. Tap to approve or reject._`;

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
