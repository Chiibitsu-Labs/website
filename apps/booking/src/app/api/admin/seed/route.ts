import { NextRequest, NextResponse } from 'next/server';
import { seedProjects, hasDatabase } from '@/lib/db';
import { errorMessage } from '@/lib/utils';
import { checkAdminAuth } from '@/lib/admin-auth';

export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!hasDatabase()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    await seedProjects();
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = errorMessage(err, 'Seed failed');
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
