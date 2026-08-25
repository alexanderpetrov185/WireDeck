import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE } from '@/lib/server/admin-auth';
import { isFormPost, seeOther } from '@/lib/server/backend-client';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/auth/logout — сбрасывает admin session cookie.
 * Нативная форма (без JS): 303 redirect на /login.
 */
export function POST(req: NextRequest): NextResponse {
  if (isFormPost(req)) {
    // Нативная форма: 303 на /login + сброс cookie в том же ответе.
    const redirect = seeOther('/login');
    redirect.cookies.set({ name: ADMIN_SESSION_COOKIE, value: '', path: '/', maxAge: 0 });
    return redirect;
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set({ name: ADMIN_SESSION_COOKIE, value: '', path: '/', maxAge: 0 });
  return response;
}