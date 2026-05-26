/**
 * One-time script to get your Google OAuth2 refresh token.
 * Run once, copy the refresh token into your .env, done.
 *
 * Usage:
 *   node scripts/get-refresh-token.mjs
 */

import { createServer } from 'http';
import { google } from 'googleapis';
import { readFileSync } from 'fs';

// Read from .env manually (dotenv not installed in scripts)
function readEnv() {
  try {
    const env = readFileSync('.env', 'utf8');
    const vars = {};
    for (const line of env.split('\n')) {
      const [k, ...rest] = line.split('=');
      if (k && rest.length) vars[k.trim()] = rest.join('=').trim();
    }
    return vars;
  } catch {
    return {};
  }
}

const env = readEnv();
const CLIENT_ID = env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('\n❌  GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env first.\n');
  process.exit(1);
}

const REDIRECT_URI = 'http://localhost:3333/callback';
const SCOPES = ['https://www.googleapis.com/auth/calendar'];

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent',
});

console.log('\n──────────────────────────────────────────────');
console.log('  Google OAuth Setup');
console.log('──────────────────────────────────────────────');
console.log('\n1. Open this URL in your browser:\n');
console.log('   ' + authUrl);
console.log('\n2. Sign in with your Google account and allow access.');
console.log('3. You\'ll be redirected back here automatically.');
console.log('\n──────────────────────────────────────────────\n');

const server = createServer(async (req, res) => {
  if (!req.url?.startsWith('/callback')) return;

  const url = new URL(req.url, 'http://localhost:3333');
  const code = url.searchParams.get('code');

  if (!code) {
    res.end('No code received. Please try again.');
    return;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    res.end('<h2>Success! Check your terminal.</h2><p>You can close this tab.</p>');

    console.log('✅  Got your tokens!\n');
    console.log('──────────────────────────────────────────────');
    console.log('Add this to your .env file:');
    console.log('──────────────────────────────────────────────\n');
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
    console.log('──────────────────────────────────────────────\n');
  } catch (err) {
    res.end('Error getting token. Check terminal.');
    console.error('Error:', err.message);
  } finally {
    server.close();
    process.exit(0);
  }
});

server.listen(3333, () => {
  console.log('Waiting for Google redirect on http://localhost:3333 …\n');
});
