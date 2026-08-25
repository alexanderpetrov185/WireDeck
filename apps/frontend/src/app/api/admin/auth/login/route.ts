import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  computeSessionValue,
  safeEqual,
} from '@/lib/server/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/auth/login
 * Принимает { password } (JSON) или application/x-www-form-urlencoded
 * (native form fallback без JS). Сверяет с ADMIN_PASSWORD (constant-time),
 * при успехе ставит httpOnly session cookie для доступа к /api/admin/*.
 * Если ADMIN_PASSWORD не настроен — вход невозможен (безопасный дефолт).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    return NextResponse.json(
      { error: 'admin_configuration_error', message: 'ADMIN_PASSWORD is not configured on the server.' },
      { status: 500 },
    );
  }

  let provided: string | undefined;
  try {
    const contentType = req.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const body = (await req.json()) as { password?: unknown };
      if (typeof body?.password === 'string') {
        provided = body.password;
      }
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      // Fallback для нативной отправки формы без JS.
      const form = await req.formData();
      const value = form.get('password');
      if (typeof value === 'string') {
        provided = value;
      }
    }
  } catch {
    provided = undefined;
  }

  if (!provided || !safeEqual(provided, password)) {
    return NextResponse.json(
      { error: 'unauthorized', message: 'Invalid credentials.' },
      { status: 401 },
    );
  }

  const sessionValue = await computeSessionValue(password);
  // Secure-флаг ставим только для https (в т.ч. за reverse-proxy),
  // иначе cookie не отправляется по http://localhost и admin UI ломается.
  const forwardedProto = req.headers.get('x-forwarded-proto');
  const isHttps = forwardedProto
    ? forwardedProto.split(',')[0].trim() === 'https'
    : req.nextUrl.protocol === 'https:';
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: sessionValue,
    httpOnly: true,
    sameSite: 'lax',
    secure: isHttps,
    path: '/',
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  });
  return response;
}