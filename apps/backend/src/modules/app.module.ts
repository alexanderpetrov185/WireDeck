// Модуль приложения NestJS
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config'; // Модуль для работы с конфигурацией
import { TypeOrmModule } from '@nestjs/typeorm'; // Модуль для работы с TypeORM и базой данных
import { HealthModule } from '../health/health.module'; // Модуль для проверки состояния приложения
import { LoggerModule } from '../common/logger/logger.module'; // Модуль логирования
import { MetricsModule } from '../common/metrics/metrics.module'; // Модуль метрик Prometheus

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
      database: process.env.DB_NAME || 'cryptobot', // Имя базы данных
      autoLoadEntities: true, // Автоматическая загрузка сущностей
      synchronize: process.env.NODE_ENV !== 'production', // Синхронизация схемы БД (только для разработки)
    }),
    HealthModule, // Модуль проверки состояния приложения
    LoggerModule, // Модуль логирования (глобальный)
    MetricsModule, // Модуль метрик Prometheus (глобальный)
  ],
  controllers: [], // Здесь будут регистрироваться контроллеры
  providers: [], // Здесь будут регистрироваться сервисы
})
// Главный модуль приложения
export class AppModule {}