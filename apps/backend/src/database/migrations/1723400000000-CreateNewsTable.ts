import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Миграция создания таблицы news и необходимых индексов.
 * Идемпотентная: использует IF NOT EXISTS, чтобы не падать,
 * если схема уже частично создана вручную.
 */
export class CreateNewsTable1723400000000 implements MigrationInterface {
  name = 'CreateNewsTable1723400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Создаём enum-типы идемпотентно (PostgreSQL не поддерживает CREATE TYPE IF NOT EXISTS,
    // поэтому используем DO-блок с проверкой pg_type)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'news_source_enum') THEN
          CREATE TYPE news_source_enum AS ENUM ('twitter','newsapi','google_news','binance','coingecko','rss','manual');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'news_language_enum') THEN
          CREATE TYPE news_language_enum AS ENUM ('en','ru','uz');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'news_status_enum') THEN
          CREATE TYPE news_status_enum AS ENUM ('raw','processed','translated','queued','approved','published','rejected');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'news_sentiment_enum') THEN
          CREATE TYPE news_sentiment_enum AS ENUM ('positive','negative','neutral');
        END IF;
      END
      $$;
    `);

    // Создаём таблицу news (IF NOT EXISTS)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS news (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        source_id varchar(64) NOT NULL,
        source_url varchar(512),
        source news_source_enum NOT NULL,
        source_name varchar(255),
        author varchar(255),
        trust_score real,
        raw_text text NOT NULL,
        source_language news_language_enum DEFAULT 'en',
        status news_status_enum DEFAULT 'raw',
        title varchar(512),
        summary text,
        translated_text text,
        importance real,
        sentiment news_sentiment_enum,
        category varchar(64),
        hash varchar(64) UNIQUE NOT NULL,
        duplicate_of uuid,
        telegram_message_id bigint,
        moderated_by varchar(255),
        moderated_at timestamptz,
        rejection_reason text,
        published_at timestamptz,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      )
    `);

    // Индексы (IF NOT EXISTS)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_news_status ON news(status)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_news_category ON news(category)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_news_hash ON news(hash)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_news_source_source_id ON news(source, source_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_news_published_at ON news(published_at)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_news_created_at ON news(created_at)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Откат: удаляем таблицу и типы
    await queryRunner.query(`DROP TABLE IF EXISTS news`);
    await queryRunner.query(`DROP TYPE IF EXISTS news_source_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS news_language_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS news_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS news_sentiment_enum`);
  }
}