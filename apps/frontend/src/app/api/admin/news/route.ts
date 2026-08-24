import { NextRequest, NextResponse } from 'next/server';
import { proxyBackend } from '@/lib/server/backend-client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/news?limit=&skip=&status=
 * Проксирует GET /news на backend, передавая только разрешённые query params.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const searchParams = req.nextUrl.searchParams;

  // Передаём только разрешённые параметры.
  const allowed = new URLSearchParams();
  const limit = searchParams.get('limit');
  const skip = searchParams.get('skip');
  const status = searchParams.get('status');

  if (limit !== null) allowed.set('limit', limit);
  if (skip !== null) allowed.set('skip', skip);
  if (status !== null) allowed.set('status', status);

  const qs = allowed.toString();
  return proxyBackend(`/news${qs ? `?${qs}` : ''}`);
}