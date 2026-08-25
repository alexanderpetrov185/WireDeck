import { NextRequest, NextResponse } from 'next/server';
import { proxyBackend, isFormPost, seeOther, safeNext } from '@/lib/server/backend-client';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/pipeline/trigger
 * Проксирует POST /pipeline/trigger на backend.
 * Нативная HTML-форма (без JS): после успеха — 303 redirect на next.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const response = await proxyBackend('/pipeline/trigger', {
    method: 'POST',
  });

  if (isFormPost(req)) {
    let next = '/';
    try {
      const form = await req.formData();
      next = safeNext(form.get('next'));
    } catch {
      // остаёмся на '/'
    }
    return seeOther(next);
  }
  return response;
}