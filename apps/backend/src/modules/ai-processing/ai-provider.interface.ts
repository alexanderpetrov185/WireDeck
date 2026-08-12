import { AiResult } from './ai-result.interface';

/**
 * Контракт AI-провайдера.
 * Провайдер можно менять, реализуя этот интерфейс.
 */
export interface AiProvider {
  /**
   * Суммаризация и классификация текста новости.
   * @param rawText Сырой текст новости
   * @returns AiResult { summary, importance, category }
   * @throws Error если ответ невалидный или провайдер недоступен
   */
  summarize(rawText: string): Promise<AiResult>;
}