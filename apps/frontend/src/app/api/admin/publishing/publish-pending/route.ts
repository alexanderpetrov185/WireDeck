import { NextRequest, NextResponse } from 'next/server';
import {
  proxyBackendParsed,
  isFormPost,
  seeOther,
  safeNext,
  withQueryParam,
} from '@/lib/server/backend-client';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/publishing/publish-pending
 * Проксирует POST /publishing/publish-pending?limit= на backend.
 * Нативная форма: 303 redirect на next с banner-параметрами
 * (?published=N&failed=M).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const formPost = isFormPost(req);

  let limit = 50;
  let next = '/';
  if (formPost) {
    try {
      const form = await req.formData();
      next = safeNext(form.get('next'));
      const rawLimit = Number(form.get('limit'));
      if (!isNaN(rawLimit) && rawLimit > 0 && rawLimit <= 200) {
        limit = rawLimit;
      }
    } catch {
      // дефолты
    }
  }

  const { status, body } = await proxyBackendParsed(`/publishing/publish-pending?limit=${limit}`, {
    method: 'POST',
  });

  if (formPost) {
    const processed = Number(body?.processed ?? 0);
    const errors = Number(body?.errors ?? 0);
    return seeOther(withQueryParam(withQueryParam(next, 'published', String(processed)), 'failed', String(errors)));
  }
  return NextResponse.json(body ?? { error: 'backend_error' }, { status });
}