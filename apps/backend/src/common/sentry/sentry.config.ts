// Конфигурация Sentry для отслеживания ошибок
// Отправляет ошибки и исключения в Sentry

import * as Sentry from '@sentry/node';

export interface SentryConfig {
  dsn: string;
  environment: string;
  tracesSampleRate: number;
  profilesSampleRate: number;
}

// Инициализация Sentry
export function initSentry(config: SentryConfig) {
  if (!config.dsn) {
    console.warn('Sentry DSN not provided. Sentry will not be initialized.');
    return;
  }

  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    
    // Sample rate for tracing (1.0 = capture all transactions)
    tracesSampleRate: config.tracesSampleRate,
    
    // Sample rate for profiling (1.0 = capture all profiles)
    profilesSampleRate: config.profilesSampleRate,
    
    // Интеграции
    integrations: [
      // HTTP запросы
      Sentry.httpIntegration(),
      // Express
      Sentry.expressIntegration(),
      // База данных
      Sentry.prismaIntegration(),
      // Redis
      Sentry.redisIntegration(),
      // Консольные логи
      Sentry.consoleIntegration(),
    ],
    
    // Фильтрация чувствительных данных
    beforeSend(event, hint) {
      // Удаление чувствительных данных из события
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

// Middleware для обработки ошибок в Express
export function sentryErrorHandler() {
  return Sentry.Handlers.errorHandler();
}

// Middleware для tracing запросов
export function sentryTracingHandler() {
  return Sentry.Handlers.tracingHandler();
}

// Хелпер для захвата исключений
export function captureException(error: Error, context?: Record<string, unknown>) {
  Sentry.captureException(error, { extra: context });
}

// Хелпер для захвата сообщений
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
  Sentry.captureMessage(message, level);
}

// Хелпер для добавления контекста
export function setSentryContext(key: string, value: Record<string, unknown>) {
  Sentry.setContext(key, value);
}

// Хелпер для установки пользователя
export function setSentryUser(userId: string, email?: string) {
  Sentry.setUser({ id: userId, email });
}
