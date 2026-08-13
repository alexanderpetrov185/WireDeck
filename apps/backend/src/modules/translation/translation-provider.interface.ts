/**
 * Контракт translation-провайдера.
 * Провайдер можно менять, реализуя этот интерфейс.
 */
export interface TranslationProvider {
  /**
   * Перевод текста на целевой язык.
   * @param text Исходный текст для перевода
   * @param targetLanguage Целевой язык (ISO код, например: 'en', 'ru')
   * @returns Переведённый текст
   * @throws Error если ответ невалидный или провайдер недоступен
   */
  translate(text: string, targetLanguage: string): Promise<string>;
}
