import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  computeSessionValue,
  safeEqual,
} from '@/lib/server/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * Safe next path: только внутренние пути, начинающиеся с '/',
 * без protocol-relative ('//') — защита от open redirect.
 */
function safeNext(raw: string | null | undefined): string {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
}

/**
 * POST /api/admin/auth/login
 *
 * Два режима по content-type:
 * A) fetch/JS (application/json):
 *    - успех: 200 JSON {ok:true} + session cookie (клиент делает redirect сам);
 *    - ошибка: 401 JSON.
 * B) native form POST (application/x-www-form-urlencoded, fallback без JS):
 *    - успех: 303 redirect на safe next (пользователь попадает в UI, а не на JSON);
 *    - ошибка: 303 redirect на /login?error=invalid (password в URL не попадает).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return NextResponse.json(
      { error: 'admin_configuration_error', message: 'ADMIN_PASSWORD is not configured on the server.' },
      { status: 500 },
    );
  }

  const contentType = req.headers.get('content-type') ?? '';
  const isFormPost = contentType.includes('application/x-www-form-urlencoded');

  let provided: string | undefined;
  let nextPath = '/';
  try {
    if (!isFormPost) {
      const body = (await req.json()) as { password?: unknown };
      if (typeof body?.password === 'string') {
        provided = body.password;
      }
    } else {
      const form = await req.formData();
      const value = form.get('password');
      if (typeof value === 'string') {
        provided = value;
      }
      const formNext = form.get('next');
      if (typeof formNext === 'string') {
        nextPath = safeNext(formNext);
      }
    }
  } catch {
    provided = undefined;
  }

  const setSessionCookie = (
    response: NextResponse,
  ) => {
    // Secure-флаг ставим только для https (в т.ч. за reverse-proxy),
    // иначе cookie не отправляется по http://localhost и admin UI ломается.
    const forwardedProto = req.headers.get('x-forwarded-proto');
    const isHttps = forwardedProto
      ? forwardedProto.split(',')[0].trim() === 'https'
      : req.nextUrl.protocol === 'https:';
    response.cookies.set({
      name: ADMIN_SESSION_COOKIE,
      value: sessionValue,
      httpOnly: true,
      sameSite: 'lax',
      secure: isHttps,
      path: '/',
      maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    });
  };

  const failure = (): NextResponse => {
    if (isFormPost) {
      // Без password в query; сохраняем next, чтобы повторный логин вернул куда надо.
      // Относительный Location обязателен: абсолютный URL соберётся с hostname
      // контейнера, недоступным браузеру снаружи.
      let location = '/login?error=invalid';
      if (nextPath !== '/') {
        location += `&next=${encodeURIComponent(nextPath)}`;
      }
      return new NextResponse(null, { status: 303, headers: { Location: location } });
    }
    return NextResponse.json(
      { error: 'unauthorized', message: 'Invalid credentials.' },
      { status: 401 },
    );
  };

  if (!provided || !safeEqual(provided, adminPassword)) {
    return failure();
  }

  const sessionValue = await computeSessionValue(adminPassword);

  if (isFormPost) {
    const response = new NextResponse(null, { status: 303, headers: { Location: nextPath } });
    setSessionCookie(response);
    return response;
  }

  const response = NextResponse.json({ ok: true });
  setSessionCookie(response);
  return response;
}