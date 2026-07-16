import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { sendSimpleMessage, hasTelegram } from '@/lib/telegram';

interface TallyField {
  key: string;
  label: string;
  type: string;
  value: unknown;
}

// Tally signs each webhook: base64(HMAC-SHA256(raw body, signing secret)) in
// the tally-signature header. Enforced when TALLY_SIGNING_SECRET is set;
// without it anyone who finds this URL can forge payment notifications.
function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.TALLY_SIGNING_SECRET;
  if (!secret) {
    console.warn('TALLY_SIGNING_SECRET not set — accepting webhook unverified');
    return true;
  }
  if (!signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  return sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
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
  const rawBody = await req.text();

  if (!verifySignature(rawBody, req.headers.get('tally-signature'))) {
    return NextResponse.json({ ok: false, error: 'Invalid signature' }, { status: 401 });
  }

  let body: { data?: { formId?: string; formName?: string; fields?: TallyField[] } };
  try {
    body = JSON.parse(rawBody);
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
