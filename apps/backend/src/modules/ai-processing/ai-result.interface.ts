/**
 * Результат AI-обработки новости.
 */
export interface AiResult {
  /** Краткая выжимка (обязательна, непустая) */
  summary: string;
  /** Важность 0..1 (clamp) */
  importance: number;
  /** Категория из допустимого набора */
  category: string;
}