import { NextRequest } from 'next/server';
import crypto from 'crypto';

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Credentials are accepted from headers only — never query params, which end
// up in server/proxy logs and browser history.
export function checkAdminAuth(req: NextRequest): boolean {
  const envPassword = process.env.ADMIN_PASSWORD;
  if (!envPassword) return false;

  const password = req.headers.get('x-admin-password') ?? '';
  const email = req.headers.get('x-admin-email') ?? '';

  const validPassword = safeEqual(password, envPassword);
  const validEmail = !process.env.ADMIN_EMAIL || email === process.env.ADMIN_EMAIL;
  return validPassword && validEmail;
}
