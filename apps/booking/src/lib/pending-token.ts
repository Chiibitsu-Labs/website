import crypto from 'crypto';

export interface PendingBookingPayload {
  projectSlug: string;
  name: string;
  email: string;
  phone: string;
  bookerCompany: string;
  startISO: string;
  endISO: string;
  customFields: Record<string, string>;
  expiresAt: number;
  rescheduleToken?: string;
}

function secret(): string {
  // Dedicated secret preferred; ADMIN_PASSWORD fallback keeps tokens issued
  // before BOOKING_TOKEN_SECRET existed verifiable. Never a hardcoded default —
  // that would let anyone forge approval links.
  const s = process.env.BOOKING_TOKEN_SECRET ?? process.env.ADMIN_PASSWORD;
  if (!s) throw new Error('BOOKING_TOKEN_SECRET (or ADMIN_PASSWORD) must be set');
  return s;
}

export function createPendingToken(payload: PendingBookingPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifyPendingToken(token: string): PendingBookingPayload | null {
  const dot = token.lastIndexOf('.');
  if (dot === -1) return null;
  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac('sha256', secret()).update(data).digest('base64url');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  const payload: PendingBookingPayload = JSON.parse(
    Buffer.from(data, 'base64url').toString(),
  );
  if (Date.now() > payload.expiresAt) return null;
  return payload;
}
