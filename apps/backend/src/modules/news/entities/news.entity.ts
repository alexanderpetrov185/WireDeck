// News entity — доменная модель новости/события
// Спроектирована с учётом будущего pipeline обработки:
// ингест → дедупликация → суммаризация → перевод → модерация → публикация в Telegram

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// Статус новости — полный жизненный цикл в пайплайне (Sprint 4 workflow)
export enum NewsStatus {
  RAW = 'raw', // сырое событие с источника
  PROCESSED = 'processed', // прошло дедуп/суммаризацию/скоринг
  TRANSLATED = 'translated', // переведено на узбекский
  QUEUED = 'queued', // ожидает модерации
  APPROVED = 'approved', // одобрено модератором
  PUBLISHED = 'published', // опубликовано в Telegram
  REJECTED = 'rejected', // отклонено модератором
}

// Тип источника данных
export enum NewsSource {
  TWITTER = 'twitter',
  NEWSAPI = 'newsapi',
  GOOGLE_NEWS = 'google_news',
  BINANCE = 'binance',
  COINGECKO = 'coingecko',
  RSS = 'rss',
  MANUAL = 'manual',
}

// Язык контента (источники EN/RU → целевой UZ)
export enum NewsLanguage {
  EN = 'en',
  RU = 'ru',
  UZ = 'uz',
}

// Тональность новости — результат будущего sentiment-анализа (Sprint 7)
export enum NewsSentiment {
  POSITIVE = 'positive',
  NEGATIVE = 'negative',
  NEUTRAL = 'neutral',
}

@Entity('news')
@Index(['status'])
@Index(['category'])
export class News {
  // Первичный ключ (uuid)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ID события в источнике (tweet id / article id / symbol+timestamp) — основа дедупа по источнику
  @Column({ name: 'source_id', type: 'varchar', length: 64 })
  sourceId: string;

  // Ссылка на оригинал (требование: короткая выжимка + ссылка на источник)
  @Column({ name: 'source_url', type: 'varchar', length: 512, nullable: true })
  sourceUrl: string | null;

  // Тип источника
  @Column({ type: 'enum', enum: NewsSource })
  source: NewsSource;

  // Имя источника (будет связано с таблицей sources)
  @Column({ name: 'source_name', type: 'varchar', length: 255, nullable: true })
  sourceName: string | null;

  // Автор/аккаунт (для Twitter/X и RSS) — для allowlist и атрибуции
  @Column({ type: 'varchar', length: 255, nullable: true })
  author: string | null;

  // Trust score источника 0..1 (документация: таблица источников с trust_score)
  @Column({ name: 'trust_score', type: 'real', nullable: true })
  trustScore: number | null;

  // Сырой текст с источника
  @Column({ name: 'raw_text', type: 'text' })
  rawText: string;

  // Язык оригинала
  @Column({ name: 'source_language', type: 'enum', enum: NewsLanguage, default: NewsLanguage.EN })
  sourceLanguage: NewsLanguage;

  // Стадия пайплайна
  @Column({ type: 'enum', enum: NewsStatus, default: NewsStatus.RAW })
  status: NewsStatus;

  // Заголовок (формат выжимки: заголовок + 1 предложение)
  @Column({ type: 'varchar', length: 512, nullable: true })
  title: string | null;

  // Краткая выжимка (Sprint 2 Summarizer)
  @Column({ type: 'text', nullable: true })
  summary: string | null;

  // Переведённый текст на узбекский (Sprint 3 AI Translation)
  @Column({ name: 'translated_text', type: 'text', nullable: true })
  translatedText: string | null;

  // Важность/confidence 0..1 (Sprint 2 scoring)
  @Column({ type: 'real', nullable: true })
  importance: number | null;

  // Тональность (Sprint 7 sentiment analysis)
  @Column({ type: 'enum', enum: NewsSentiment, nullable: true })
  sentiment: NewsSentiment | null;

  // Категория: news / tweet / price-alert / analytics
  @Column({ type: 'varchar', length: 64, nullable: true })
  category: string | null;

  // SHA-256 хэш нормализованного текста — дедупликация (Sprint 2)
  // Уникальность индекса задана через unique: true в Column
  @Column({ type: 'varchar', length: 64, unique: true })
  hash: string;

  // Ссылка на оригинал при дубликате (Sprint 2 dedup)
  // Храним только id оригинала. Связь не объявляем, чтобы избежать
  // дублирования колонки (TypeORM создаёт FK из @JoinColumn).
  @Column({ name: 'duplicate_of', type: 'uuid', nullable: true })
  duplicateOf: string | null;

  // ID сообщения в Telegram после публикации (Sprint 5)
  @Column({ name: 'telegram_message_id', type: 'bigint', nullable: true })
  telegramMessageId: string | null;

  // Кто одобрил/отклонил (Sprint 4 Moderation audit)
  @Column({ name: 'moderated_by', type: 'varchar', length: 255, nullable: true })
  moderatedBy: string | null;

  // Когда прошла модерация (Sprint 4)
  @Column({ name: 'moderated_at', type: 'timestamptz', nullable: true })
  moderatedAt: Date | null;

  // Причина отклонения (Sprint 4)
  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string | null;

  // Время публикации новости в оригинальном источнике
  // (заполняется коллектором при сборе данных)
  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  // Время создания
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  // Время последнего обновления
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}