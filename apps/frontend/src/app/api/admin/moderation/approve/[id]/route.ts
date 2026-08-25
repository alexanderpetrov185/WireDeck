import { NextRequest, NextResponse } from 'next/server';
import { proxyBackend, isFormPost, seeOther, safeNext } from '@/lib/server/backend-client';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/moderation/approve/:id
 * Проксирует POST /moderation/approve/:id?moderator=... на backend.
 * moderator берётся из server-side env ADMIN_MODERATOR.
 * Нативная HTML-форма: после успеха — 303 redirect на next (/moderation).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const moderator = process.env.ADMIN_MODERATOR || 'frontend-admin';
  const qs = new URLSearchParams({ moderator });
  const response = await proxyBackend(`/moderation/approve/${encodeURIComponent(id)}?${qs.toString()}`, {
    method: 'POST',
  });

  if (isFormPost(req)) {
    let next = '/moderation';
    try {
      const form = await req.formData();
      next = safeNext(form.get('next'), '/moderation');
    } catch {
      // остаёмся на /moderation
    }
    return seeOther(next);
  }
  return response;
}