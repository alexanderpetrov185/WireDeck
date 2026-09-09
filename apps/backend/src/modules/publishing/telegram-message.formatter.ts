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
  category?: string | null;
  // ── Sprint 22a: market-impact ──
  impactThesis?: string | null;
  affectedAssets?: string | null;
  affectedSectors?: string | null;
  timeHorizon?: string | null;
  unconfirmed?: boolean | null;
}

/**
 * Sprint 21: хэштеги поста.
 * Категория-маппинг (совпадает с доменами AI-классификации, см. ARCHITECTURE.md)
 * + небольшой keyword-фолбэк по телу/заголовку. Максимум MAX_HASHTAGS шт,
 * без спама — только простой словарь, без ML.
 */
const MAX_HASHTAGS = 3;

const CATEGORY_HASHTAGS: Record<string, string> = {
  finance: '#finance',
  markets: '#markets',
  business: '#business',
  economy: '#economy',
  technology: '#tech',
  crypto: '#crypto',
  oil: '#oil',
};

// Sprint 22c: тег по типу источника (Twitter/X посты помечаются #x).
const SOURCE_HASHTAGS: Record<string, string> = {
  twitter: '#x',
};

const KEYWORD_HASHTAGS: Array<{ re: RegExp; tag: string }> = [
  { re: /\boil\b/i, tag: '#oil' },
  { re: /\bgold\b/i, tag: '#gold' },
  { re: /\bbitcoin\b/i, tag: '#bitcoin' },
  { re: /\beth(ereum)?\b/i, tag: '#eth' },
  { re: /\bfed\b|\binterest rates\b/i, tag: '#fed' },
  { re: /\bstocks?\b/i, tag: '#stocks' },
  { re: /\bcrypto(currency)?\b/i, tag: '#crypto' },
  { re: /\bmarkets?\b/i, tag: '#markets' },
  { re: /\bgdp\b|\binflation\b/i, tag: '#macro' },
];

/** Валидация хэштега: только латиница/цифры/подчёркивание. */
function sanitizeHashtag(raw: string): string | null {
  const cleaned = raw.replace('#', '').replace(/[^A-Za-z0-9_]/g, '').trim();
  return cleaned ? `#${cleaned}` : null;
}

/**
 * Выводит до MAX_HASHTAGS уникальных хэштегов.
 * Сначала кандидат из category-мапа, затем keyword-совпадения по телу/заголовку.
 */
export function buildHashtags(news: TelegramMessageNews): string[] {
  const tags: string[] = [];

  // 1) Категория.
  const cat = news.category?.trim().toLowerCase();
  if (cat) {
    const byCategory = CATEGORY_HASHTAGS[cat];
    const sanitized = byCategory ? sanitizeHashtag(byCategory) : null;
    if (sanitized && !tags.includes(sanitized)) {
      tags.push(sanitized);
    }
  }

  // 1b) Sprint 22c: тег источника (twitter → #x).
  const src = news.source?.trim().toLowerCase();
  if (src) {
    const bySource = SOURCE_HASHTAGS[src];
    const sanitized = bySource ? sanitizeHashtag(bySource) : null;
    if (sanitized && !tags.includes(sanitized)) {
      tags.push(sanitized);
    }
  }

  // 2) Keyword-фолбэк по тексту поста (тело/заголовок/raw).
  const haystack = `${news.title ?? ''} ${news.summary ?? ''} ${news.translatedText ?? ''} ${news.rawText ?? ''}`;

  for (const { re, tag } of KEYWORD_HASHTAGS) {
    if (tags.length >= MAX_HASHTAGS) {
      break;
    }
    if (re.test(haystack)) {
      const sanitized = sanitizeHashtag(tag);
      if (sanitized && !tags.includes(sanitized)) {
        tags.push(sanitized);
      }
    }
  }

  return tags.slice(0, MAX_HASHTAGS);
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
 * Строка impacted-активов/секторов/горизонта: "🎯 OIL · SPX · intraday".
 * Пустая строка, если нет ни активов, ни секторов, ни горизонта.
 */
export function buildImpactLine(news: TelegramMessageNews): string {
  const assets = (news.affectedAssets ?? '')
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean);
  const sectors = (news.affectedSectors ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const horizon = ['intraday', 'short', 'medium'].includes(news.timeHorizon ?? '')
    ? (news.timeHorizon as string)
    : '';

  const items = [...assets, ...sectors].slice(0, 6).map((item) => `· ${item}`);
  if (items.length === 0 && !horizon) {
    return '';
  }
  const parts = ['🎯', ...items];
  if (horizon) {
    parts.push(`· ${horizon}`);
  }
  return parts.join(' ');
}

/**
 * Собирает итоговый текст Telegram-сообщения.
 * footnotes — обязательные compliance-сноски (Sprint 19), append в конец
 * с учётом length-budget (не вытесняются truncation'ом).
 * Sprint 21: до 3 хэштегов (после source, перед сносками).
 * Sprint 22a: impact thesis + assets/horizon line + unconfirmed banner.
 * Гарантирует длину ≤ MAX_MESSAGE_LENGTH.
 */
export function buildTelegramMessage(news: TelegramMessageNews, footnotes: string[] = []): string {
  const title = truncateAtWordBoundary(news.title ?? '', MAX_TITLE_LENGTH);

  let body = buildMessageBody(news);
  // Убираем дубль: body часто начинается теми же словами, что и title.
  if (title && body.toLowerCase().startsWith(title.toLowerCase())) {
    body = body.slice(title.length).replace(/^\s*[—–\-:.]*\s*/, '').trim();
  }

  const sourceLine = buildSourceLine(news);

  // Sprint 22a: impact-first блоки.
  const thesis = (news.impactThesis ?? '').trim();
  const impactLine = buildImpactLine(news);
  const unconfirmedBanner = news.unconfirmed === true ? '⚠️ НЕ ПОДТВЕРЖДЕНО' : '';

  // Sprint 21: хэштеги (до 3 шт), отдельный блок после source.
  const hashtags = buildHashtags(news);
  const hashtagLine = hashtags.length > 0 ? hashtags.join(' ') : '';
  const hasHashtags = hashtagLine.length > 0;

  // Compliance-сноски: отдельный блок в конце (пустая строка перед блоком).
  const footnoteBlock = footnotes.length > 0 ? footnotes.join('\n') : '';

  const parts: string[] = [];
  if (unconfirmedBanner) {
    parts.push(unconfirmedBanner);
  }
  if (title) {
    parts.push(title);
  }
  if (body) {
    parts.push(body);
  }
  if (thesis) {
    parts.push(truncateAtWordBoundary(thesis, 500));
  }
  if (impactLine) {
    parts.push(impactLine);
  }
  if (sourceLine) {
    parts.push(sourceLine);
  }

  // Бюджет базовой части: резервируем место под хэштеги и сноски.
  // 2 символа на каждый '\n\n' разделитель.
  const suffixLength = (hasHashtags ? hashtagLine.length + 2 : 0) +
    (footnoteBlock ? footnoteBlock.length + 2 : 0);
  const baseBudget = MAX_MESSAGE_LENGTH - suffixLength;

  let message = parts.join('\n\n');

  // Последний предохранитель по общей длине: жмём body, сохраняя source/title/suffix.
  if (message.length > baseBudget && body) {
    const excess = message.length - baseBudget;
    body = truncateAtWordBoundary(body, Math.max(100, body.length - excess - 1));
    message = [unconfirmedBanner, title, body, thesis, impactLine, sourceLine].filter(Boolean).join('\n\n');
  }

  if (hasHashtags) {
    message = `${message}\n\n${hashtagLine}`;
  }

  if (footnoteBlock) {
    message = `${message}\n\n${footnoteBlock}`;
  }

  return message.trim();
}