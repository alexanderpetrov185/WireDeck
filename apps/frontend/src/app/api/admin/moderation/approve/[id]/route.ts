import { NextRequest, NextResponse } from 'next/server';
import { proxyBackend } from '@/lib/server/backend-client';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/moderation/approve/:id
 * Проксирует POST /moderation/approve/:id?moderator=... на backend.
 * moderator берётся из server-side env ADMIN_MODERATOR.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const moderator = process.env.ADMIN_MODERATOR || 'frontend-admin';
  const qs = new URLSearchParams({ moderator });
  return proxyBackend(`/moderation/approve/${encodeURIComponent(id)}?${qs.toString()}`, {
    method: 'POST',
  });
}