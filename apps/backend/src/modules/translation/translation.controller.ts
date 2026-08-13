import { Controller, Post, Param, Query, UseGuards, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { TranslationService } from './translation.service';
import { TranslationResult } from './translation-result.interface';
import { TokenGuard } from '../../common/guards/token.guard';
import { NewsLanguage } from '../news/entities/news.entity';

/**
 * Допустимые целевые языки для перевода.
 */
const VALID_TARGET_LANGUAGES = new Set(Object.values(NewsLanguage));

@Controller('translation')
export class TranslationController {
  constructor(private readonly translationService: TranslationService) {}

  /**
   * Ручной запуск пакетного перевода новостей со статусом PROCESSED.
   * Роут: POST /translation/run
   * Требует заголовок x-ingestion-token (см. INGESTION_TOKEN в env).
   * @param limit Максимум новостей за один прогон
   * @param targetLanguage Целевой язык (по умолчанию из TRANSLATION_TARGET_LANGUAGE)
   * @param force Перевести, даже если уже TRANSLATED
   */
  @Post('run')
  @UseGuards(TokenGuard)
  @HttpCode(HttpStatus.OK)
  async runPending(
    @Query('limit') limit: number = 50,
    @Query('targetLanguage') targetLanguage?: string,
    @Query('force') force: boolean = false,
  ): Promise<TranslationResult> {
    const lang = this.resolveTargetLanguage(targetLanguage);
    return this.translationService.translatePending(limit, lang, force);
  }

  /**
   * Перевод одной новости по ID.
   * Роут: POST /translation/run/:id
   * Требует заголовок x-ingestion-token (см. INGESTION_TOKEN в env).
   * @param id ID новости
   * @param targetLanguage Целевой язык (по умолчанию из TRANSLATION_TARGET_LANGUAGE)
   * @param force Перевести, даже если уже TRANSLATED
   */
  @Post('run/:id')
  @UseGuards(TokenGuard)
  @HttpCode(HttpStatus.OK)
  async runOne(
    @Param('id') id: string,
    @Query('targetLanguage') targetLanguage?: string,
    @Query('force') force: boolean = false,
  ): Promise<TranslationResult> {
    const lang = this.resolveTargetLanguage(targetLanguage);
    return this.translationService.translateOne(id, lang, force);
  }

  /**
   * Определение целевого языка: из query param или из env (TRANSLATION_TARGET_LANGUAGE).
   * Валидация против NewsLanguage enum.
   */
  private resolveTargetLanguage(targetLanguage?: string): string {
    const lang = targetLanguage || process.env.TRANSLATION_TARGET_LANGUAGE || NewsLanguage.EN;
    if (!VALID_TARGET_LANGUAGES.has(lang as NewsLanguage)) {
      throw new BadRequestException(
        `Invalid targetLanguage "${lang}". Valid values: ${Array.from(VALID_TARGET_LANGUAGES).join(', ')}`,
      );
    }
    return lang;
  }
}
