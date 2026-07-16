import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import crypto from 'crypto';

// One-time setup flow, opened by navigating a browser to
// /api/auth/google?password=... — query auth is unavoidable here because a
// redirect flow can't send headers. Rotate ADMIN_PASSWORD if it ever leaks.
export async function GET(req: NextRequest) {
  const password = req.nextUrl.searchParams.get('password');
  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? `https://${req.headers.get('host')}`;
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri,
  );

  // CSRF nonce — checked against the cookie in the callback. Never put a
  // secret (like the admin password) in `state`: it round-trips through
  // Google's servers, browser history, and request logs.
  const state = crypto.randomBytes(16).toString('base64url');

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar'],
    prompt: 'consent',
    state,
  });

  const res = NextResponse.redirect(authUrl);
  res.cookies.set('g_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600, // the round-trip to Google takes seconds, not hours
    path: '/api/auth/google',
  });
  return res;
}
