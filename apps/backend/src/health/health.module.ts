// Модуль проверки состояния приложения
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus'; // Модуль для проверки состояния сервисов
import { HttpModule } from '@nestjs/axios'; // Модуль для HTTP запросов
import { HealthController } from './health.controller'; // Контроллер для эндпоинтов проверки состояния

@Module({
  // Подключение необходимых модулей для проверки состояния
  imports: [TerminusModule, HttpModule],
  // Регистрация контроллера проверки состояния
  controllers: [HealthController],
  providers: [], // Здесь будут регистрироваться сервисы для проверки состояния
})
// Модуль для проверки состояния приложения
export class HealthModule {}