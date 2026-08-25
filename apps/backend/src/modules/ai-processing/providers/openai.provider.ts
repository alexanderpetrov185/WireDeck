import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AiProvider } from '../ai-provider.interface';
import { AiResult } from '../ai-result.interface';
import { LoggerService } from '../../../common/logger/logger.service';

/**
 * Допустимые категории для классификации новостей.
 */
const ALLOWED_CATEGORIES = new Set([
  'news',
  'markets',
  'economy',
  'technology',
  'business',
  'crypto',
]);

const DEFAULT_AI_MODEL = 'gpt-4o-mini';
const DEFAULT_AI_URL = 'https://api.openai.com/v1/chat/completions';
const AI_TIMEOUT_MS = 30000; // 30 секунд
import { DEFAULT_AI_RATE_LIMIT_RETRIES as DEFAULT_RATE_LIMIT_RETRIES, DEFAULT_AI_RATE_LIMIT_BASE_DELAY_MS as DEFAULT_RATE_LIMIT_BASE_DELAY_MS } from '../../pipeline/pipeline.constants';
import { RateLimitError, withRateLimitRetry } from '../../../common/rate-limit/rate-limited.client';

/**
 * OpenAI-compatible провайдер через HTTP.
 * Настраивается через env: AI_PROVIDER_URL, AI_API_KEY, AI_MODEL.
 * Если AI_API_KEY не задан — summarize выбрасывает понятную ошибку.
 */
@Injectable()
export class OpenAiProvider implements AiProvider {
  private readonly context = 'OpenAiProvider';

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Суммаризация и классификация текста.
   * Возвращает строго валидированный AiResult.
   */
  async summarize(rawText: string): Promise<AiResult> {
    const apiKey = this.configService.get<string>('AI_API_KEY', '');
    if (!apiKey) {
      throw new Error('AI_API_KEY is not configured. Set AI_API_KEY environment variable.');
    }

    const url = this.configService.get<string>('AI_PROVIDER_URL', DEFAULT_AI_URL);
    const model = this.configService.get<string>('AI_MODEL', DEFAULT_AI_MODEL);

    const prompt = `You are a financial news analyst. Given the article text, return ONLY valid JSON with exactly these fields:
{
  "summary": "one or two sentence summary",
  "importance": number between 0 and 1,
  "category": "one of: news, markets, economy, technology, business, crypto"
}
Article text:
${rawText.slice(0, 4000)}`;

    try {
      const response = await withRateLimitRetry(
        () =>
          firstValueFrom(
            this.httpService.post(
              url,
              {
                model,
                temperature: 0.2,
                messages: [
                  { role: 'system', content: 'You are a concise financial news summarizer.' },
                  { role: 'user', content: prompt },
                ],
              },
              {
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${apiKey}`,
                },
                timeout: AI_TIMEOUT_MS,
              },
            ),
          ),
        {
          maxRetries: this.configService.get<number>('AI_RATE_LIMIT_RETRIES', DEFAULT_RATE_LIMIT_RETRIES),
          baseDelayMs: this.configService.get<number>('AI_RATE_LIMIT_BASE_DELAY_MS', DEFAULT_RATE_LIMIT_BASE_DELAY_MS),
          logger: this.logger,
          logContext: this.context,
        },
      );

      const content = response.data?.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('AI returned empty content');
      }

      return this.parseAiResponse(content);
    } catch (error) {
      // RateLimitError пробрасываем как есть — batch-методы используют
      // её для раннего выхода из цикла (defer remaining items).
      if (error instanceof RateLimitError) {
        throw error;
      }
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`OpenAI request failed: ${msg}`, error instanceof Error ? error.stack : undefined, this.context);
      throw new Error(`AI provider error: ${msg}`);
    }
  }

  /**
   * Парсинг и валидация JSON ответа AI.
   * summary обязателен и непустой; importance clamp 0..1; category из допустимого набора.
   */
  private parseAiResponse(content: string): AiResult {
    let parsed: any;
    try {
      // Может вернуть JSON в markdown-блоке
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      throw new Error('AI returned invalid JSON');
    }

    const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
    if (!summary) {
      throw new Error('AI response missing summary');
    }

    let importance = Number(parsed.importance);
    if (isNaN(importance)) {
      importance = 0.5;
    }
    // Clamp 0..1
    importance = Math.min(1, Math.max(0, importance));

    let category = typeof parsed.category === 'string' ? parsed.category.trim().toLowerCase() : '';
    if (!ALLOWED_CATEGORIES.has(category)) {
      this.logger.warn(`Unknown category "${category}" from AI, fallback to "news"`, this.context);
      category = 'news';
    }

    return { summary, importance, category };
  }
}