import * as crypto from 'crypto';

/**
 * Нормализация текста для стабильного хэширования.
 * Убирает HTML-теги, нормализует пробелы, приводит к нижнему регистру.
 */
export function normalizeText(text: string): string {
  return (text || '')
    .replace(/<[^>]*>/g, ' ') // удаляем HTML-теги
    .replace(/\s+/g, ' ')     // нормализуем пробелы (включая переносы)
    .trim()
    .toLowerCase();
}

/**
 * Вычисление SHA-256 хэша нормализованного текста.
 * Детерминированный: одинаковый текст → одинаковый hash.
 */
export function computeNewsHash(rawText: string): string {
  const normalized = normalizeText(rawText);
  return crypto.createHash('sha256').update(normalized).digest('hex');
}