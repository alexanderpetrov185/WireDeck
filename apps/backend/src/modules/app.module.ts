// Модуль приложения NestJS
import { Module } from '@nestjs/common';
import { join } from 'path';
import { ConfigModule } from '@nestjs/config'; // Модуль для работы с конфигурацией
import { TypeOrmModule } from '@nestjs/typeorm'; // Модуль для работы с TypeORM и базой данных
import { HealthModule } from '../health/health.module'; // Модуль для проверки состояния приложения
import { LoggerModule } from '../common/logger/logger.module'; // Модуль логирования
import { MetricsModule } from '../common/metrics/metrics.module'; // Модуль метрик Prometheus
import { NewsModule } from './news/news.module'; // Модуль доменной модели новостей
import { CollectorModule } from './collector/collector.module'; // Модуль сбора новостей
import { IngestionModule } from './ingestion/ingestion.module'; // Модуль оркестрации сбора новостей
import { AiProcessingModule } from './ai-processing/ai-processing.module'; // Модуль AI-обработки новостей
import { TranslationModule } from './translation/translation.module'; // Модуль перевода новостей
import { ModerationModule } from './moderation/moderation.module'; // Модуль модерации новостей
import { PublishingModule } from './publishing/publishing.module';
import { ComplianceModule } from './compliance/compliance.module'; // Sprint 19: RF compliance labeling (watchlists)
import { PipelineModule } from './pipeline/pipeline.module'; // Модуль Scheduler + BullMQ (Sprint 9)

@Module({
  imports: [
    // Глобальный модуль конфигурации, позволяет использовать ConfigService в любом месте приложения
    ConfigModule.forRoot({ isGlobal: true }),
    // Настройка подключения к базе данных PostgreSQL через TypeORM
    TypeOrmModule.forRoot({
      type: 'postgres', // Тип базы данных
      host: process.env.DB_HOST || 'localhost', // Адрес сервера базы данных
      port: parseInt(process.env.DB_PORT, 10) || 5432, // Порт подключения
      username: process.env.DB_USERNAME || 'postgres', // Имя пользователя
      password: process.env.DB_PASSWORD || 'postgres', // Пароль
      database: process.env.DB_NAME || 'wiredeck', // Имя базы данных
      autoLoadEntities: true, // Автоматическая загрузка сущностей
      // Синхронизация схемы всегда выключена — применяем миграции (migrationsRun: true)
      synchronize: false,
      // Путь к миграциям через __dirname:
      // dev (ts-node): src/modules/app.module.ts → src/database/migrations
      // prod (dist):   dist/modules/app.module.js   → dist/database/migrations
      migrations: [join(__dirname, '..', 'database', 'migrations', '*.{ts,js}')],
      migrationsRun: true,
    }),
    HealthModule, // Модуль проверки состояния приложения
    LoggerModule, // Модуль логирования (глобальный)
    MetricsModule, // Модуль метрик Prometheus (глобальный)
    NewsModule, // Модуль доменной модели новостей
    CollectorModule, // Модуль сбора новостей
    IngestionModule, // Модуль оркестрации сбора новостей
    AiProcessingModule, // Модуль AI-обработки новостей
    TranslationModule, // Модуль перевода новостей
    ModerationModule, // Модуль модерации новостей
    PublishingModule, // Модуль публикации новостей
    ComplianceModule, // Sprint 19: RF compliance labeling (watchlists)
    PipelineModule, // Модуль Scheduler + BullMQ (Sprint 9)
  ],
  controllers: [], // Здесь будут регистрироваться контроллеры
  providers: [], // Здесь будут регистрироваться сервисы
})
// Главный модуль приложения
export class AppModule {}