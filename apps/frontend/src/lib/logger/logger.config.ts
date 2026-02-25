// Winston конфигурация для frontend
// Логирование на клиенте и сервере

import winston from 'winston';

// Формат для development (цветной вывод в консоли)
const developmentFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}] ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  }),
);

// Формат для production (JSON)
const productionFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.json(),
);

// Создание экземпляра логгера
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: 'crypto-news-frontend' },
  transports: [
    // Консольный вывод
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production' ? productionFormat : developmentFormat,
    }),
  ],
});

// Хелпер для создания контекстного логгера
export function createContextLogger(context: string) {
  return {
    debug: (message: string, meta?: Record<string, unknown>) => 
      logger.debug(message, { context, ...meta }),
    info: (message: string, meta?: Record<string, unknown>) => 
      logger.info(message, { context, ...meta }),
    warn: (message: string, meta?: Record<string, unknown>) => 
      logger.warn(message, { context, ...meta }),
    error: (message: string, meta?: Record<string, unknown>) => 
      logger.error(message, { context, ...meta }),
  };
}

// Клиентский логгер (для браузера)
// Отправляет логи на сервер для агрегации
export const clientLogger = {
  debug: (message: string, meta?: Record<string, unknown>) => {
    console.debug(`[DEBUG] ${message}`, meta);
    // Можно отправить на сервер для агрегации
  },
  info: (message: string, meta?: Record<string, unknown>) => {
    console.info(`[INFO] ${message}`, meta);
  },
  warn: (message: string, meta?: Record<string, unknown>) => {
    console.warn(`[WARN] ${message}`, meta);
  },
  error: (message: string, meta?: Record<string, unknown>) => {
    console.error(`[ERROR] ${message}`, meta);
    // Автоматическая отправка ошибок в Sentry
  },
};
