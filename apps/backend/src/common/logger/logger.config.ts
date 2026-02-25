// Конфигурация Winston для логирования
// Создает транспорты для консоли и файлов с ротацией

import * as winston from 'winston';
import 'winston-daily-rotate-file';

// Формат логов для production (JSON)
const productionFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

// Формат логов для development (цветной консольный вывод)
const developmentFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
    let msg = `${timestamp} [${level}] ${message}`;
    if (context) {
      msg += ` [${context}]`;
    }
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  }),
);

// Транспорт для ежедневной ротации файлов
const dailyRotateTransport = new winston.transports.DailyRotateFile({
  filename: 'logs/application-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  format: productionFormat,
});

// Транспорт для ошибок (отдельный файл)
const errorTransport = new winston.transports.DailyRotateFile({
  filename: 'logs/error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  level: 'error',
  format: productionFormat,
});

// Создание экземпляра логгера
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: 'crypto-news-bot' },
  transports: [
    // Консольный вывод
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production' ? productionFormat : developmentFormat,
    }),
    // Файловые транспорты (только в production)
    ...(process.env.NODE_ENV === 'production' ? [dailyRotateTransport, errorTransport] : []),
  ],
});

// Интерфейс для контекстного логгера
export interface LoggerContext {
  context?: string;
  [key: string]: unknown;
}

// Хелпер для создания контекстного логгера
export function createContextLogger(context: string) {
  return {
    debug: (message: string, meta?: LoggerContext) => logger.debug(message, { context, ...meta }),
    info: (message: string, meta?: LoggerContext) => logger.info(message, { context, ...meta }),
    warn: (message: string, meta?: LoggerContext) => logger.warn(message, { context, ...meta }),
    error: (message: string, meta?: LoggerContext) => logger.error(message, { context, ...meta }),
  };
}
