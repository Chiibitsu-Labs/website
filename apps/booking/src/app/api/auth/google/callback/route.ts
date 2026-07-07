import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const expectedState = req.cookies.get('g_oauth_state')?.value;

  if (!state || !expectedState || state !== expectedState) {
    return new NextResponse('Unauthorized: OAuth state mismatch. Start again from /api/auth/google.', {
      status: 401,
    });
  }

  if (!code) {
    return new NextResponse('No code received from Google', { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? `https://${req.headers.get('host')}`;
  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri,
  );

  try {
    const { tokens } = await oauth2Client.getToken(code);
    const refreshToken = tokens.refresh_token;

    if (!refreshToken) {
      return new NextResponse(
        `<html><body style="font-family:system-ui;padding:32px;max-width:600px;margin:0 auto">
          <h2 style="color:#dc2626">No refresh token received</h2>
          <p>This usually means you've already authorized this app before.
          Go back and try again — Google will show the account picker and issue a new token.</p>
          <a href="javascript:history.back()" style="color:#4f46e5">← Go back</a>
        </body></html>`,
        { headers: { 'Content-Type': 'text/html' } },
      );
    }

    return new NextResponse(
      `<html>
      <head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
      <body style="font-family:system-ui,sans-serif;background:#f9fafb;padding:24px;max-width:560px;margin:0 auto">
        <div style="background:#fff;border-radius:16px;padding:28px;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
          <div style="width:40px;height:40px;background:#10b981;border-radius:50%;display:flex;align-items:center;justify-content:center;margin-bottom:16px">
            <span style="color:white;font-size:20px">✓</span>
          </div>
          <h2 style="margin:0 0 8px;color:#111827">Google Calendar connected!</h2>
          <p style="color:#6b7280;font-size:14px;margin:0 0 20px">
            Copy the token below and add it to your environment variables as
            <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px">GOOGLE_REFRESH_TOKEN</code>.
          </p>
          <div style="background:#1e1e2e;border-radius:10px;padding:16px;margin-bottom:20px;word-break:break-all">
            <p style="margin:0 0 8px;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">GOOGLE_REFRESH_TOKEN</p>
            <code id="token" style="color:#a5f3fc;font-size:13px;font-family:monospace">${refreshToken}</code>
          </div>
          <button onclick="navigator.clipboard.writeText('${refreshToken}').then(()=>this.textContent='Copied!')"
            style="background:#4f46e5;color:white;border:none;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;width:100%">
            Copy token
          </button>
          <p style="margin:16px 0 0;font-size:12px;color:#9ca3af">
            On Vercel: go to your project → Settings → Environment Variables → add GOOGLE_REFRESH_TOKEN.<br>
            On DigitalOcean: App → Settings → Environment Variables.
          </p>
        </div>
      </body></html>`,
      { headers: { 'Content-Type': 'text/html' } },
    );
  } catch (err) {
    console.error('OAuth callback error:', err);
    return new NextResponse('Failed to exchange code for token', { status: 500 });
  }
}
