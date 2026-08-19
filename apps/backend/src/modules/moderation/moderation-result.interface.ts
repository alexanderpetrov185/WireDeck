/**
 * Результат модерации новостей.
 * Единый формат ответа с AiProcessingResult и TranslationResult.
 */
export interface ModerationResult {
  processed: number;
  skipped: number;
  errors: number;
}