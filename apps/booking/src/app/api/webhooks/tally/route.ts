import { NextRequest, NextResponse } from 'next/server';
import { sendSimpleMessage, hasTelegram } from '@/lib/telegram';

interface TallyField {
  key: string;
  label: string;
  type: string;
  value: unknown;
}

function fieldValue(fields: TallyField[], label: string): string {
  const f = fields.find((x) => x.label === label);
  if (!f || f.value === null || f.value === undefined) return '';
  if (typeof f.value === 'string') return f.value;
  if (typeof f.value === 'number') return String(f.value);
  if (Array.isArray(f.value)) return (f.value as string[]).filter(Boolean).join(', ');
  return '';
}

export async function POST(req: NextRequest) {
  let body: { data?: { formId?: string; formName?: string; fields?: TallyField[] } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const { formId, formName, fields = [] } = body.data ?? {};

  if (!hasTelegram()) {
    return NextResponse.json({ ok: true });
  }

  const companyName = fieldValue(fields, 'Company Name');
  const name = fieldValue(fields, 'Your Name');
  const email = fieldValue(fields, 'Email Address');
  const phone = fieldValue(fields, 'Contact Number');
  const paymentMethod = fieldValue(fields, 'Payment Method Used');
  const paymentRef = fieldValue(fields, 'Payment Reference Number');
  const attendees = fieldValue(fields, 'Number of Attendees');
  const exclusiveCode = fieldValue(fields, 'Exclusive Code');
  const notes = fieldValue(fields, 'Anything else you want us to know?');

  const lines = [
    `💳 *Payment confirmation received*`,
    formName ? `📋 ${formName}` : null,
    ``,
    companyName ? `🏢 ${companyName}` : null,
    `👤 ${name}`,
    `📧 ${email}`,
    phone ? `📱 ${phone}` : null,
    attendees ? `👥 ${attendees} attendees` : null,
    ``,
    paymentMethod ? `💰 Method: ${paymentMethod}` : null,
    paymentRef ? `🔖 Ref: \`${paymentRef}\`` : null,
    exclusiveCode ? `🎟️ Code: ${exclusiveCode}` : null,
    notes ? `📝 ${notes}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  await sendSimpleMessage(lines).catch((e) =>
    console.error('Tally webhook Telegram error:', e),
  );

  console.log('Tally webhook received:', { formId, name, email, paymentRef });

  return NextResponse.json({ ok: true });
}
