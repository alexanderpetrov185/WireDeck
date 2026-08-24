import { NextRequest, NextResponse } from 'next/server';
import { proxyBackend } from '@/lib/server/backend-client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/news/:id
 * Проксирует GET /news/:id на backend.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  return proxyBackend(`/news/${encodeURIComponent(id)}`);
}