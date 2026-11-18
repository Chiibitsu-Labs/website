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
  // Backslash is in the class so it is escaped in the same pass (no double
  // processing). ']' is deliberately absent: legacy Markdown cannot escape it,
  // and emitting a backslash before it would show up literally in the message.
  return text.replace(/([\\_*[`])/g, '\\$1');
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
}): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return false;

  const approveUrl = `${baseUrl}/api/booking-approval?token=${encodeURIComponent(bookingToken)}&action=approve`;
  const rejectUrl = `${baseUrl}/api/booking-approval?token=${encodeURIComponent(bookingToken)}&action=reject`;

  // Booker-supplied text must be escaped in Markdown mode: one stray "_" or "*"
  // makes Telegram reject the whole message. Plain mode is the fallback.
  const build = (md: boolean) => {
    const e = (v: string) => (md ? escapeMarkdown(v) : v);
    const b = (v: string) => (md ? `*${v}*` : v);
    const i = (v: string) => (md ? `_${v}_` : v);

    const extraLines = [
      bookerPhone ? `📱 ${e(bookerPhone)}` : null,
      bookerCompany ? `🏢 ${e(bookerCompany)}` : null,
      ...Object.entries(customFields)
        .filter(([, v]) => v)
        .map(([k, v]) => `• ${e(k)}: ${e(v)}`),
    ]
      .filter(Boolean)
      .join('\n');

    const header = isReschedule
      ? `🔄 ${b('Reschedule request — approval needed')}`
      : `⏳ ${b('New booking — approval needed')}`;

    const dateSection = isReschedule && originalDateLabel
      ? `📅 ${b('New date:')} ${e(dateLabel)}\n↩️ ${b('Was:')} ${e(originalDateLabel)}`
      : `📅 ${e(dateLabel)}`;

    return (
      `${header}\n\n` +
      `📌 ${e(projectName)}\n` +
      `${dateSection}\n` +
      `🕐 ${e(timeLabel)} – ${e(endLabel)}\n\n` +
      `👤 ${e(bookerName)}\n` +
      `📧 ${e(bookerEmail)}` +
      (extraLines ? `\n${extraLines}` : '') +
      `\n\n${i('Tap below to approve or reject.')}`
    );
  };

  const reply_markup = {
    inline_keyboard: [[
      { text: '✅ Approve', url: approveUrl },
      { text: '❌ Reject', url: rejectUrl },
    ]],
  };

  const attempts: Array<{ text: string; parse_mode?: 'Markdown' }> = [
    { text: build(true), parse_mode: 'Markdown' },
    { text: build(false) },
  ];
  for (const attempt of attempts) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, reply_markup, ...attempt }),
      });
      if (res.ok) return true;
      console.error(
        `Telegram sendApprovalRequest failed (${attempt.parse_mode ?? 'plain'}):`,
        res.status,
        await res.text().catch(() => ''),
      );
    } catch (e) {
      console.error('Telegram sendApprovalRequest error:', e);
    }
  }
  return false;
}
