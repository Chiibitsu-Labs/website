import { NextRequest, NextResponse } from 'next/server';
import { getAllProjectsAdmin, createProject, hasDatabase } from '@/lib/db';
import { errorMessage } from '@/lib/utils';

function checkAuth(req: NextRequest) {
  const password = req.headers.get('x-admin-password') ?? req.nextUrl.searchParams.get('password');
  const email = req.headers.get('x-admin-email') ?? req.nextUrl.searchParams.get('email');
  const validPassword = password === process.env.ADMIN_PASSWORD;
  const validEmail = !process.env.ADMIN_EMAIL || email === process.env.ADMIN_EMAIL;
  return validPassword && validEmail;
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasDatabase()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const projects = await getAllProjectsAdmin();
  return NextResponse.json({ projects });
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasDatabase()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  try {
    const body = await req.json();
    const project = await createProject(body);
    return NextResponse.json({ project });
  } catch (err: unknown) {
    const msg = errorMessage(err, 'Failed to create project');
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
