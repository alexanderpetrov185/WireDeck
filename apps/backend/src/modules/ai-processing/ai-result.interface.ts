/**
 * Результат AI-обработки новости.
 * Sprint 22a: добавлены market-impact поля (nullable/optional —
 * провайдер может их не вернуть, тогда сохранится legacy-поведение).
 */
export interface AiResult {
  /** Краткая выжимка (обязательна, непустая) */
  summary: string;
  /** Важность 0..1 (clamp) */
  importance: number;
  /** Категория из допустимого набора */
  category: string;
  /** Рыночная значимость 0..1; undefined = не оценена */
  impactScore?: number;
  /** 1-3 предложения: к чему может привести событие */
  impactThesis?: string | null;
  /** Затронутые активы/тикеры (уже sanitized) */
  affectedAssets?: string | null;
  /** Затронутые секторы (уже sanitized) */
  affectedSectors?: string | null;
  /** Горизонт: intraday / short / medium */
  timeHorizon?: string | null;
}
