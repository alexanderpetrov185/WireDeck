import { NextResponse } from 'next/server';
import { ADMIN_SESSION_COOKIE } from '@/lib/server/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/auth/logout — сбрасывает admin session cookie.
 */
export function POST(): NextResponse {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({ name: ADMIN_SESSION_COOKIE, value: '', path: '/', maxAge: 0 });
  return response;
}