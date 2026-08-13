/**
 * Результат перевода новостей.
 * Единый формат ответа с AiProcessingResult.
 */
export interface TranslationResult {
  processed: number;
  skipped: number;
  errors: number;
}
