import { NextRequest, NextResponse } from 'next/server';
import { proxyBackend } from '@/lib/server/backend-client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/news/stats
 * Проксирует GET /news/stats на backend.
 */
export async function GET(_req: NextRequest): Promise<NextResponse> {
  return proxyBackend('/news/stats');
}