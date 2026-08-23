// Точка входа приложения NestJS
// Инициализирует приложение с логированием, метриками и Sentry

import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app.module'; // Главный модуль приложения
import { ConfigService } from '@nestjs/config'; // Сервис для работы с конфигурацией
import { initSentry, setSentryContext } from './common/sentry/sentry.config'; // Sentry для отслеживания ошибок
import { Logger } from '@nestjs/common';

/**
 * Функция инициализации и запуска приложения
 * Создает экземпляр NestJS приложения, настраивает порт и запускает сервер
 */
async function bootstrap() {
  // Инициализация Sentry для отслеживания ошибок
  initSentry({
    dsn: process.env.SENTRY_DSN || '',
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  });

  // Создание экземпляра приложения с использованием главного модуля
  const app = await NestFactory.create(AppModule);

  // Включение shutdown hooks для корректного graceful shutdown
  // BullMQ Worker/Queue, Scheduler и остальных ресурсов (Sprint 9).
  app.enableShutdownHooks();

  // Получение сервиса конфигурации для получения настроек
  const configService = app.get(ConfigService);
  
  // Получение номера порта из переменных окружения или использование значения по умолчанию
  const port = configService.get('PORT', 3000);
  const nodeEnv = configService.get('NODE_ENV', 'development');

  // Добавление контекста в Sentry
  setSentryContext('app', {
    port,
    nodeEnv,
    version: process.env.npm_package_version || '1.0.0',
  });

  // Запуск прослушивания порта
  await app.listen(port);
  
  // Логирование запуска приложения
  Logger.log(`Application is running on: http://localhost:${port}`, 'Bootstrap');
  Logger.log(`Environment: ${nodeEnv}`, 'Bootstrap');
}

// Запуск функции инициализации с обработкой ошибок
bootstrap().catch((error) => {
  Logger.error(error, 'Bootstrap');
  process.exit(1);
});
