import { NextRequest, NextResponse } from 'next/server';
import { proxyBackend, isFormPost, seeOther, safeNext } from '@/lib/server/backend-client';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/moderation/reject/:id
 * Проксирует POST /moderation/reject/:id?moderator=...&reason=... на backend.
 * moderator берётся из server-side env ADMIN_MODERATOR.
 * reason приходит в JSON body от fetch-клиента или в formData от нативной формы.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const formPost = isFormPost(req);

  let reason = '';
  let next = '/moderation';
  try {
    if (formPost) {
      const form = await req.formData();
      const value = form.get('reason');
      if (typeof value === 'string') {
        reason = value.trim();
      }
      next = safeNext(form.get('next'), '/moderation');
    } else {
      const body = (await req.json()) as { reason?: unknown };
      if (typeof body.reason === 'string') {
        reason = body.reason.trim();
      }
    }
  } catch {
    // невалидный body — reason останется пустым, backend вернёт 400
  }

  const moderator = process.env.ADMIN_MODERATOR || 'frontend-admin';
  const qs = new URLSearchParams({ moderator });
  if (reason) {
    qs.set('reason', reason);
  }

  const response = await proxyBackend(`/moderation/reject/${encodeURIComponent(id)}?${qs.toString()}`, {
    method: 'POST',
  });

  if (formPost) {
    return seeOther(next);
  }
  return response;
}