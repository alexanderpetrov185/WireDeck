import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint 21: расширяем source_id с varchar(64) до varchar(512).
 *
 * RSS guid/link часто являются полными URL (>64 символов) — узкая колонка
 * вызывала "value too long" при ингестии новостей (data loss).
 * varchar(512) согласуется с source_url (512) и остаётся index-friendly
 * (не text), чтобы не ломать композитный индекс (source, source_id).
 *
 * Widen — метаданные-операция в Postgres 15 (короткая блокировка, не переписывает таблицу).
 * down(): возврат к 64 возможен, но упадёт, если уже есть значения >64 (документированный случай).
 */
export class WidenNewsSourceId20260829000000 implements MigrationInterface {
  name = 'WidenNewsSourceId20260829000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE news ALTER COLUMN source_id TYPE varchar(512)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE news ALTER COLUMN source_id TYPE varchar(64)
    `);
  }
}
