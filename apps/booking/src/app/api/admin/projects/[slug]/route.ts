import { NextRequest, NextResponse } from 'next/server';
import { updateProject, deleteProject, hasDatabase } from '@/lib/db';

function checkAuth(req: NextRequest) {
  const password = req.headers.get('x-admin-password') ?? req.nextUrl.searchParams.get('password');
  const email = req.headers.get('x-admin-email') ?? req.nextUrl.searchParams.get('email');
  const validPassword = password === process.env.ADMIN_PASSWORD;
  const validEmail = !process.env.ADMIN_EMAIL || email === process.env.ADMIN_EMAIL;
  return validPassword && validEmail;
}

export async function PUT(req: NextRequest, { params }: { params: { slug: string } }) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasDatabase()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  try {
    const body = await req.json();
    const project = await updateProject(params.slug, body);
    return NextResponse.json({ project });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update project';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { slug: string } }) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasDatabase()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  try {
    await deleteProject(params.slug);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete project';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
