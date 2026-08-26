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
 * POST /api/admin/publishing/publish/:id
 * Проксирует POST /publishing/publish/:id на backend.
 * Backend всегда отвечает 200 с body {processed,skipped,errors}:
 * - processed=1            → успех (опубликовано в Telegram);
 * - skipped=1              → уже опубликована ранее;
 * - errors=1               → не approved / Telegram failure.
 * Нативная форма: 303 redirect на next с banner-параметром.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const formPost = isFormPost(req);

  let next = `/news/${id}`;
  if (formPost) {
    try {
      const form = await req.formData();
      next = safeNext(form.get('next'), `/news/${id}`);
    } catch {
      // дефолтный next
    }
  }

  const { status, body } = await proxyBackendParsed(`/publishing/publish/${encodeURIComponent(id)}`, {
    method: 'POST',
  });

  const processed = Number(body?.processed ?? 0);
  const skipped = Number(body?.skipped ?? 0);
  const errors = Number(body?.errors ?? 0);

  if (formPost) {
    let location: string;
    if (status === 200 && errors === 0 && processed > 0) {
      location = withQueryParam(next, 'published', '1');
    } else if (status === 200 && errors === 0 && skipped > 0) {
      location = withQueryParam(next, 'already_published', '1');
    } else {
      location = withQueryParam(next, 'publish_error', '1');
    }
    return seeOther(location);
  }

  return NextResponse.json(body ?? { error: 'backend_error' }, { status });
}