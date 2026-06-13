import { NextRequest, NextResponse } from 'next/server';

// Temporary debug endpoint — remove after login is confirmed working.
export async function GET(req: NextRequest) {
  const password = req.headers.get('x-admin-password') ?? req.nextUrl.searchParams.get('password') ?? '';
  const email = req.headers.get('x-admin-email') ?? req.nextUrl.searchParams.get('email') ?? '';

  const envPassword = process.env.ADMIN_PASSWORD ?? '';
  const envEmail = process.env.ADMIN_EMAIL ?? '';

  return NextResponse.json({
    passwordMatch: password === envPassword,
    emailMatch: !envEmail || email === envEmail,
    envPasswordLength: envPassword.length,
    envPasswordFirstChar: envPassword.slice(0, 1),
    envPasswordLastChar: envPassword.slice(-1),
    envEmailSet: !!envEmail,
    envEmailValue: envEmail,
    sentPasswordLength: password.length,
    sentEmail: email,
  });
}
