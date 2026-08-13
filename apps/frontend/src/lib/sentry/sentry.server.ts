// Sentry конфигурация для серверной части Next.js
// Мониторинг ошибок на сервере

import * as Sentry from '@sentry/nextjs';

// Инициализация Sentry на сервере
export function initSentryServer() {
  const dsn = process.env.SENTRY_DSN;
  
  if (!dsn) {
    console.warn('Sentry DSN not provided. Sentry will not be initialized.');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    
    // Sample rate for transactions
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    
    // Sample rate for profiling
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    
    // Интеграции для Node.js
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration(),
    ],
    
    // Фильтрация чувствительных данных
    beforeSend(event, _hint) {
      if (event.request) {
        delete event.request.cookies;
        if (event.request.headers) {
          delete event.request.headers.authorization;
        }
      }
      return event;
    },
  });
}

// Хелпер для захвата ошибок на сервере
export function captureServerException(error: Error, context?: Record<string, unknown>) {
  Sentry.captureException(error, { extra: context });
}

// Хелпер для захвата сообщений
export function captureServerMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
  Sentry.captureMessage(message, level);
}

// Middleware для отслеживания ошибок в API роутах
export function withSentryApiHandler(handler: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    try {
      return await handler(req);
    } catch (error) {
      captureServerException(error as Error, {
        url: req.url,
        method: req.method,
      });
      throw error;
    }
  };
}
