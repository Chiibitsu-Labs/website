import { NextRequest, NextResponse } from 'next/server';
import { seedProjects, hasDatabase } from '@/lib/db';

function checkAuth(req: NextRequest) {
  const password = req.headers.get('x-admin-password') ?? req.nextUrl.searchParams.get('password');
  const email = req.headers.get('x-admin-email') ?? req.nextUrl.searchParams.get('email');
  const validPassword = password === process.env.ADMIN_PASSWORD;
  const validEmail = !process.env.ADMIN_EMAIL || email === process.env.ADMIN_EMAIL;
  return validPassword && validEmail;
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!hasDatabase()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    await seedProjects();
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Seed failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
