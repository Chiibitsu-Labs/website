export function hasTelegram(): boolean {
  return !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

export async function sendAfternoonAlert({
  bookerName,
  bookerEmail,
  bookerPhone,
  bookerCompany,
  projectName,
  dateLabel,
  timeLabel,
  endLabel,
  customFields,
  eventLink,
}: {
  bookerName: string;
  bookerEmail: string;
  bookerPhone?: string;
  bookerCompany?: string;
  projectName: string;
  dateLabel: string;
  timeLabel: string;
  endLabel: string;
  customFields: Record<string, string>;
  eventLink?: string;
}) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return;

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
    `🔔 *Both slots booked — heads up!*\n\n` +
    `📌 ${projectName}\n` +
    `📅 ${dateLabel}\n` +
    `🕐 Afternoon: ${timeLabel} – ${endLabel}\n\n` +
    `👤 ${bookerName}\n` +
    `📧 ${bookerEmail}` +
    (extraLines ? `\n${extraLines}` : '') +
    `\n\n_Morning AND afternoon are now booked on this day._`;

  const buttons = eventLink
    ? { reply_markup: { inline_keyboard: [[{ text: '📅 View in Calendar', url: eventLink }]] } }
    : {};

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      ...buttons,
    }),
  });
}
