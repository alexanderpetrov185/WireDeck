// Sentry конфигурация для Next.js
// Мониторинг ошибок и производительности на frontend

import * as Sentry from '@sentry/nextjs';

// Инициализация Sentry на клиенте
export function initSentryClient() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  
  if (!dsn) {
    console.warn('Sentry DSN not provided. Sentry will not be initialized.');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    
    // Sample rate for transactions (1.0 = capture all)
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    
    // Sample rate for profiling
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    
    // Интеграции для React
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    
    // Настройка реплеев сессий
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    
    // Фильтрация чувствительных данных
    beforeSend(event, hint) {
      // Удаление чувствительных данных
      if (event.request) {
        delete event.request.cookies;
      }
      return event;
    },
    
    // Игнорирование определенных ошибок
    ignoreErrors: [
      // Ошибки расширений браузера
      'top.GLOBALS',
      'canvas.contentDocument',
      // Ошибки сети
      'Network request failed',
      'NetworkError',
      // Ошибки загрузки ресурсов
      'Non-Error promise rejection captured',
    ],
  });
}

// Хелпер для захвата ошибок на клиенте
export function captureClientException(error: Error, context?: Record<string, unknown>) {
  Sentry.captureException(error, { extra: context });
}

// Хелпер для установки пользователя
export function setClientUser(userId: string, email?: string) {
  Sentry.setUser({ id: userId, email });
}

// Хелпер для добавления тегов
export function setClientTag(key: string, value: string) {
  Sentry.setTag(key, value);
}
