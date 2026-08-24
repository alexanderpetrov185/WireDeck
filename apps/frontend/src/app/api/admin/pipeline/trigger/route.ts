import { NextRequest, NextResponse } from 'next/server';
import { proxyBackend } from '@/lib/server/backend-client';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/pipeline/trigger
 * Проксирует POST /pipeline/trigger на backend.
 */
export async function POST(_req: NextRequest): Promise<NextResponse> {
  return proxyBackend('/pipeline/trigger', {
    method: 'POST',
  });
}