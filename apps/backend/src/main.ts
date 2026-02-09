// Импорт основных компонентов NestJS
import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app.module'; // Главный модуль приложения
import { ConfigService } from '@nestjs/config'; // Сервис для работы с конфигурацией

/**
 * Функция инициализации и запуска приложения
 * Создает экземпляр NestJS приложения, настраивает порт и запускает сервер
 */
async function bootstrap() {
  // Создание экземпляра приложения с использованием главного модуля
  const app = await NestFactory.create(AppModule);

  // Получение сервиса конфигурации для получения настроек
  const configService = app.get(ConfigService);
  // Получение номера порта из переменных окружения или использование значения по умолчанию
  const port = configService.get('PORT', 3000);

  // Запуск прослушивания порта
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
// Запуск функции инициализации
bootstrap();