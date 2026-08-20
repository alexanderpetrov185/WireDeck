import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Publisher } from './publisher.interface';
import { LoggerService } from '../../../common/logger/logger.service';

/**
 * Провайдер публикации в Telegram.
 * Настраивается через env: TELEGRAM_BOT_TOKEN и TELEGRAM_CHANNEL_ID.
 *
 * Sprint 8.5 hardening:
 * - Сообщение обрезается до безопасного лимита (Telegram max 4096 символов).
 * - Проверяется response.data.ok === true и наличие message_id.
 */
@Injectable()
export class TelegramPublisherProvider implements Publisher {
  private readonly context = 'TelegramPublisherProvider';

  // Telegram допускает максимум 4096 символов в сообщении.
  // Используем безопасный лимит с запасом на суффикс.
  private static readonly TELEGRAM_MAX_MESSAGE_LENGTH = 4096;
  private static readonly SAFE_MESSAGE_LENGTH = 4000;
  private static readonly TRUNCATION_SUFFIX = '\n\n… (truncated)';

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Публикация сообщения в Telegram канал.
   * @param text Содержимое сообщения
   * @returns Идентификатор сообщения в Telegram
   */
  async publish(text: string): Promise<string> {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN', '');
    const channelId = this.configService.get<string>('TELEGRAM_CHANNEL_ID', '');

    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN is not configured. Set TELEGRAM_BOT_TOKEN environment variable.');
    }
    if (!channelId) {
      throw new Error('TELEGRAM_CHANNEL_ID is not configured. Set TELEGRAM_CHANNEL_ID environment variable.');
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    // Безопасное ограничение длины сообщения (Telegram max 4096).
    const safeText = this.truncate(text);

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          url,
          {
            chat_id: channelId,
            text: safeText,
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
            timeout: 15000, // 15 секунд таймаут
          },
        ),
      );

      // Проверяем ok: true и наличие message_id.
      const ok = response.data?.ok === true;
      const messageId = response.data?.result?.message_id;

      if (!ok) {
        const description = response.data?.description || 'unknown error';
        throw new Error(`Telegram returned ok:false (${description})`);
      }

      if (!messageId) {
        throw new Error('Telegram response did not contain message_id');
      }

      return String(messageId);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Telegram publish request failed: ${msg}`, error instanceof Error ? error.stack : undefined, this.context);
      throw new Error(`Telegram publisher error: ${msg}`);
    }
  }

  /**
   * Обрезает сообщение до безопасного лимита с понятным суффиксом.
   * @param text Исходное сообщение
   */
  private truncate(text: string): string {
    if (text.length <= TelegramPublisherProvider.SAFE_MESSAGE_LENGTH) {
      return text;
    }

    const suffix = TelegramPublisherProvider.TRUNCATION_SUFFIX;
    const maxBodyLength = TelegramPublisherProvider.SAFE_MESSAGE_LENGTH - suffix.length;
    const body = text.slice(0, maxBodyLength);
    return `${body}${suffix}`;
  }
}