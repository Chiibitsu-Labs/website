import { NextRequest, NextResponse } from 'next/server';
import { updateProject, deleteProject, hasDatabase } from '@/lib/db';
import { errorMessage } from '@/lib/utils';
import { checkAdminAuth } from '@/lib/admin-auth';

export async function PUT(req: NextRequest, { params }: { params: { slug: string } }) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasDatabase()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  try {
    const body = await req.json();
    const project = await updateProject(params.slug, body);
    return NextResponse.json({ project });
  } catch (err: unknown) {
    const msg = errorMessage(err, 'Failed to update project');
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { slug: string } }) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasDatabase()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  try {
    await deleteProject(params.slug);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = errorMessage(err, 'Failed to delete project');
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
