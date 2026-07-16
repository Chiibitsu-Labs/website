import { NextRequest, NextResponse } from 'next/server';
import { getAllProjectsAdmin, createProject, hasDatabase } from '@/lib/db';
import { errorMessage } from '@/lib/utils';
import { checkAdminAuth } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasDatabase()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const projects = await getAllProjectsAdmin();
  return NextResponse.json({ projects });
}

export async function POST(req: NextRequest) {
  if (!checkAdminAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
