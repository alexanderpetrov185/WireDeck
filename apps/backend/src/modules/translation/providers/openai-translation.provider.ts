import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { TranslationProvider } from '../translation-provider.interface';
import { LoggerService } from '../../../common/logger/logger.service';

const DEFAULT_TRANSLATION_MODEL = 'gpt-4o-mini';
const DEFAULT_TRANSLATION_URL = 'https://api.openai.com/v1/chat/completions';
const TRANSLATION_TIMEOUT_MS = 30000; // 30 секунд

/**
 * OpenAI-compatible translation provider через HTTP.
 * Настраивается через env: TRANSLATION_PROVIDER_URL, TRANSLATION_API_KEY, TRANSLATION_MODEL.
 * Если TRANSLATION_API_KEY не задан — translate выбрасывает понятную ошибку.
 */
@Injectable()
export class OpenAiTranslationProvider implements TranslationProvider {
  private readonly context = 'OpenAiTranslationProvider';

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Перевод текста на целевой язык.
   * Возвращает строго валидированный переведённый текст.
   */
  async translate(text: string, targetLanguage: string): Promise<string> {
    const apiKey = this.configService.get<string>('TRANSLATION_API_KEY', '');
    if (!apiKey) {
      throw new Error('TRANSLATION_API_KEY is not configured. Set TRANSLATION_API_KEY environment variable.');
    }

    const url = this.configService.get<string>('TRANSLATION_PROVIDER_URL', DEFAULT_TRANSLATION_URL);
    const model = this.configService.get<string>('TRANSLATION_MODEL', DEFAULT_TRANSLATION_MODEL);

    const prompt = `Translate the following text to ${targetLanguage}. Return ONLY the translated text, no additional formatting, no markdown, no explanation.
Text to translate:
${text.slice(0, 4000)}`;

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          url,
          {
            model,
            temperature: 0.2,
            messages: [
              { role: 'system', content: 'You are a professional translator. Translate accurately and concisely.' },
              { role: 'user', content: prompt },
            ],
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            timeout: TRANSLATION_TIMEOUT_MS,
          },
        ),
      );

      const content = response.data?.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('Translation provider returned empty content');
      }

      const translated = content.trim();
      if (!translated) {
        throw new Error('Translation provider returned empty translation');
      }

      return translated;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Translation request failed: ${msg}`, error instanceof Error ? error.stack : undefined, this.context);
      throw new Error(`Translation provider error: ${msg}`);
    }
  }
}
