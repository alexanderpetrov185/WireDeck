import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Publisher } from './publisher.interface';
import { LoggerService } from '../../../common/logger/logger.service';

/**
 * Провайдер публикации в Telegram.
 * Настраивается через env: TELEGRAM_BOT_TOKEN и TELEGRAM_CHANNEL_ID.
 */
@Injectable()
export class TelegramPublisherProvider implements Publisher {
  private readonly context = 'TelegramPublisherProvider';

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

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          url,
          {
            chat_id: channelId,
            text,
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
            timeout: 15000, // 15 секунд таймаут
          },
        ),
      );

      const messageId = response.data?.result?.message_id;
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
}
