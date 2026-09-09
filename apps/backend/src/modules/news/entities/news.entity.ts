// News entity — доменная модель новости/события
// Спроектирована с учётом будущего pipeline обработки:
// ингест → дедупликация → суммаризация → перевод → модерация → публикация

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { NewsSource } from '../constants/news-source.enum';
import { NewsLanguage } from '../constants/news-language.enum';

// Статус новости — полный жизненный цикл в пайплайне (Sprint 4 workflow)
export enum NewsStatus {
  RAW = 'raw', // сырое событие с источника
  PROCESSED = 'processed', // прошло дедуп/суммаризацию/скоринг
  TRANSLATED = 'translated', // переведено
  QUEUED = 'queued', // ожидает модерации
  APPROVED = 'approved', // одобрено модератором
  PUBLISHED = 'published', // опубликовано
  REJECTED = 'rejected', // отклонено модератором
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
@Index(['source', 'sourceId'])
@Index(['publishedAt'])
@Index(['createdAt'])
export class News {
  // Первичный ключ (uuid)
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ID события в источнике (tweet id / article id / symbol+timestamp) — основа дедупа по источнику
  // Sprint 21: varchar(64) → 512 — RSS guid/link бывают полными URL (>64), узкая колонка теряла новости.
  @Column({ name: 'source_id', type: 'varchar', length: 512 })
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

  // Переведённый текст (Sprint 3 AI Translation)
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

  // ID сообщения в канале публикации после публикации (Sprint 8 Publishing)
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

  // Sprint 19: compliance-маркировка по watchlists (comma-separated категории:
  // foreign_agent / terror_extremist / undesirable_org). NULL = clean.
  @Column({ name: 'compliance_labels', type: 'varchar', length: 255, nullable: true })
  complianceLabels: string | null;

  // ── Sprint 22a: market-impact поля (финансовая ориентация продукта) ──

  /** Рыночная значимость 0..1 от AI. NULL = legacy/не оценена. */
  @Column({ name: 'impact_score', type: 'real', nullable: true })
  impactScore: number | null;

  /** 1-3 предложения: на какие рынки/активы может повлиять и почему. */
  @Column({ name: 'impact_thesis', type: 'text', nullable: true })
  impactThesis: string | null;

  /** Затронутые активы/тикеры, comma-separated: "OIL,SPX,BTC". */
  @Column({ name: 'affected_assets', type: 'varchar', length: 255, nullable: true })
  affectedAssets: string | null;

  /** Затронутые секторы, comma-separated: "energy,banking". */
  @Column({ name: 'affected_sectors', type: 'varchar', length: 255, nullable: true })
  affectedSectors: string | null;

  /** Горизонт эффекта: intraday / short / medium. */
  @Column({ name: 'time_horizon', type: 'varchar', length: 16, nullable: true })
  timeHorizon: string | null;

  /** Tier источника: 1=market-moving, 2=useful, 3=noise. */
  @Column({ name: 'source_tier', type: 'smallint', nullable: true, default: 2 })
  sourceTier: number | null;

  /** Insider/unconfirmed-флаг: источник «ещё не официально». Маркировка в посте обязательна. */
  @Column({ type: 'boolean', nullable: true, default: false })
  unconfirmed: boolean | null;

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