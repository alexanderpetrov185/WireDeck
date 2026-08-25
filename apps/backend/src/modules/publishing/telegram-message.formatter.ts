/**
 * Sprint 13: формирование человекочитаемого Telegram-поста из новости.
 * Чистая функция — без зависимостей от DI/DB.
 *
 * Формат:
 *   {title}
 *
 *   {body: 1-2 предложения сути}
 *
 *   Source: {name} — {url}   (или только url)
 *
 * Plain text (без parse_mode): Markdown ломается на спецсимволах
 * из AI-генерированных текстов.
 */

/** Максимальная длина заголовка в посте. */
const MAX_TITLE_LENGTH = 120;
/** Целевая длина body (~1-2 предложения). */
const MAX_BODY_LENGTH = 400;
/** Общий безопасный лимит сообщения (Telegram max 4096, с запасом). */
const MAX_MESSAGE_LENGTH = 3900;
/** Fallback-длина rawText, если summary/translatedText отсутствуют. */
const RAW_TEXT_PREVIEW_LENGTH = 600;

interface TelegramMessageNews {
  title?: string | null;
  translatedText?: string | null;
  summary?: string | null;
  rawText?: string | null;
  sourceUrl?: string | null;
  sourceName?: string | null;
  source?: string | null;
}

/** Обрезает строку по границе слова, не оставляя висячего пробела/переноса. */
function truncateAtWordBoundary(text: string, maxLength: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLength) {
    return clean;
  }
  const slice = clean.slice(0, maxLength);
  const lastSpace = slice.lastIndexOf(' ');
  return (lastSpace > maxLength * 0.5 ? slice.slice(0, lastSpace) : slice).trim();
}

/**
 * Готовит тело поста: приоритет translatedText → summary → превью rawText.
 * Возвращает первые ~MAX_BODY_LENGTH символов по границе предложения/слова.
 */
export function buildMessageBody(news: TelegramMessageNews): string {
  const source = news.translatedText?.trim() || news.summary?.trim();
  if (source) {
    // Отрезаем по границе предложения, если предложение укладывается в лимит.
    if (source.length <= MAX_BODY_LENGTH) {
      return source;
    }
    const sentenceEnd = source.slice(0, MAX_BODY_LENGTH).search(/[.!?](\s|$)/);
    if (sentenceEnd > 0) {
      return source.slice(0, sentenceEnd + 1).trim();
    }
    return truncateAtWordBoundary(source, MAX_BODY_LENGTH);
  }

  // Fallback: сырой текст — только короткое превью, никогда не целиком.
  return truncateAtWordBoundary(news.rawText ?? '', RAW_TEXT_PREVIEW_LENGTH);
}

/**
 * Строка источника: "Source: CNBC — https://..." или "Source: https://...".
 * Пустая строка, если ссылки нет.
 */
export function buildSourceLine(news: TelegramMessageNews): string {
  if (!news.sourceUrl) {
    return '';
  }
  const name = news.sourceName?.trim() || news.source?.trim() || '';
  return name ? `Source: ${name} — ${news.sourceUrl}` : `Source: ${news.sourceUrl}`;
}

/**
 * Собирает итоговый текст Telegram-сообщения.
 * Гарантирует длину ≤ MAX_MESSAGE_LENGTH; при переполнении ужимается body,
 * но link и источник сохраняются всегда.
 */
export function buildTelegramMessage(news: TelegramMessageNews): string {
  const title = truncateAtWordBoundary(news.title ?? '', MAX_TITLE_LENGTH);

  let body = buildMessageBody(news);
  // Убираем дубль: body часто начинается теми же словами, что и title.
  if (title && body.toLowerCase().startsWith(title.toLowerCase())) {
    body = body.slice(title.length).replace(/^\s*[—–\-:.]*\s*/, '').trim();
  }

  const sourceLine = buildSourceLine(news);

  const parts: string[] = [];
  if (title) {
    parts.push(title);
  }
  if (body) {
    parts.push(body);
  }
  if (sourceLine) {
    parts.push(sourceLine);
  }

  let message = parts.join('\n\n');

  // Последний предохранитель по общей длине: жмём body, сохраняя source/title.
  if (message.length > MAX_MESSAGE_LENGTH && body) {
    const excess = message.length - MAX_MESSAGE_LENGTH;
    body = truncateAtWordBoundary(body, Math.max(100, body.length - excess - 1));
    message = [title, body, sourceLine].filter(Boolean).join('\n\n');
  }

  return message.trim();
}