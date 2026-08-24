import { NextRequest, NextResponse } from 'next/server';
import { proxyBackend } from '@/lib/server/backend-client';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/moderation/reject/:id
 * Проксирует POST /moderation/reject/:id?moderator=...&reason=... на backend.
 * moderator берётся из server-side env ADMIN_MODERATOR.
 * reason приходит в JSON body от клиента и безопасно URL-encode через URLSearchParams.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  let reason = '';
  try {
    const body = (await req.json()) as { reason?: unknown };
    if (typeof body.reason === 'string') {
      reason = body.reason.trim();
    }
  } catch {
    // невалидный JSON — reason останется пустым, backend вернёт 400
  }

  const moderator = process.env.ADMIN_MODERATOR || 'frontend-admin';
  const qs = new URLSearchParams({ moderator });
  if (reason) {
    qs.set('reason', reason);
  }

  return proxyBackend(`/moderation/reject/${encodeURIComponent(id)}?${qs.toString()}`, {
    method: 'POST',
  });
}