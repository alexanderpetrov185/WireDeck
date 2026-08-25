import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE, isValidAdminSession } from '@/lib/server/admin-auth';

/**
 * Минимальная защита admin BFF (security hardening):
 * - /api/admin/* (кроме /api/admin/auth/login|logout) требует валидную session cookie;
 *   иначе — 401 JSON.
 * - Страницы админки (/ , /news , /moderation) без сессии редиректятся на /login.
 *
 * Session cookie ставит POST /api/admin/auth/login после сверки пароля
 * с env ADMIN_PASSWORD. Сам пароль никогда не попадает в client bundle.
 */

const PROTECTED_PAGE_PREFIXES = ['/', '/news', '/moderation'];
const AUTH_PATH = '/api/admin/auth/login';
const LOGOUT_PATH = '/api/admin/auth/logout';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Login/logout endpoints всегда доступны (иначе нельзя войти).
  if (pathname === AUTH_PATH || pathname === LOGOUT_PATH) {
    return NextResponse.next();
  }

  const authenticated = await isValidAdminSession(
    req.cookies.get(ADMIN_SESSION_COOKIE)?.value,
  );

  if (pathname.startsWith('/api/admin/')) {
    if (!authenticated) {
      return NextResponse.json(
        { error: 'unauthorized', message: 'Authentication required.' },
        { status: 401 },
      );
    }
    return NextResponse.next();
  }

  const isProtectedPage = PROTECTED_PAGE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  );

  if (isProtectedPage && !authenticated) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/admin/:path*', '/', '/news/:path*', '/moderation/:path*'],
};