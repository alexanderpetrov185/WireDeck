// Сервис логирования для NestJS
// Обертка над Winston для использования через DI

import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { logger, createContextLogger } from './logger.config';

@Injectable()
export class LoggerService implements NestLoggerService {
  private context = 'App';

  // Установка контекста для логгера
  setContext(context: string) {
    this.context = context;
  }

  // Логирование debug уровня
  debug(message: string, context?: string) {
    createContextLogger(context || this.context).debug(message);
  }

  // Логирование info уровня
  log(message: string, context?: string) {
    createContextLogger(context || this.context).info(message);
  }

  // Логирование warning уровня
  warn(message: string, context?: string) {
    createContextLogger(context || this.context).warn(message);
  }

  // Логирование error уровня
  error(message: string, trace?: string, context?: string) {
    createContextLogger(context || this.context).error(message, { trace });
  }

  // Логирование verbose уровня
  verbose(message: string, context?: string) {
    createContextLogger(context || this.context).debug(message);
  }

  // Получение экземпляра Winston логгера (для продвинутого использования)
  getLogger() {
    return logger;
  }
}
