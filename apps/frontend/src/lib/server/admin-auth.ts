// Server-only helper для admin-аутентификации BFF.
// Минимальная схема: пароль из env ADMIN_PASSWORD -> httpOnly session cookie.
// Без JWT/RBAC/user database. Значение cookie = SHA-256(домен-тег + пароль),
// сам пароль никогда не покидает сервер и не попадает в client bundle.
//
// Использует Web Crypto (globalThis.crypto.subtle) — работает одинаково
// в Route Handlers (Node runtime) и в middleware (Edge runtime).

export const ADMIN_SESSION_COOKIE = 'wd_admin_session';
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12; // 12 часов

/**
 * Возвращает ожидаемое значение session cookie для заданного пароля.
 * SHA-256 от домен-тегированной строки, чтобы значение нельзя было
 * переиспользовать как пароль при коллизии хешей.
 */
export async function computeSessionValue(password: string): Promise<string> {
  const data = new TextEncoder().encode(`wiredeck-admin-session:v1:${password}`);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Constant-time сравнение двух hex-строк одинаковой семантики.
 * При разной длине возвращает false (утечка длины не критична для хеша).
 */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Всё равно делаем фиктивное сравнение, чтобы не светить длину по таймингу.
    let dummy = 0;
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      dummy |= (a.charCodeAt(i % Math.max(a.length, 1)) ^ b.charCodeAt(i % Math.max(b.length, 1))) & 0xff;
    }
    if (dummy !== 0 || a.length === 0 || b.length === 0) {
      return false;
    }
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Проверяет значение session cookie. Если ADMIN_PASSWORD не настроен —
 * доступ закрыт полностью (безопасный дефолт).
 */
export async function isValidAdminSession(cookieValue: string | undefined): Promise<boolean> {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || !cookieValue) {
    return false;
  }
  const expected = await computeSessionValue(password);
  return safeEqual(cookieValue, expected);
}