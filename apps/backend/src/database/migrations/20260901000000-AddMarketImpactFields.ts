import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint 22a: market-impact поля (финансовая ориентация продукта).
 * Все колонки nullable / с безопасными дефолтами — backward-compatible:
 * существующие новости продолжают работать как раньше (legacy-путь).
 * Идемпотентная: ADD COLUMN IF NOT EXISTS.
 */
export class AddMarketImpactFields20260901000000 implements MigrationInterface {
  name = 'AddMarketImpactFields20260901000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE news ADD COLUMN IF NOT EXISTS impact_score real`);
    await queryRunner.query(`ALTER TABLE news ADD COLUMN IF NOT EXISTS impact_thesis text`);
    await queryRunner.query(`ALTER TABLE news ADD COLUMN IF NOT EXISTS affected_assets varchar(255)`);
    await queryRunner.query(`ALTER TABLE news ADD COLUMN IF NOT EXISTS affected_sectors varchar(255)`);
    await queryRunner.query(`ALTER TABLE news ADD COLUMN IF NOT EXISTS time_horizon varchar(16)`);
    await queryRunner.query(`ALTER TABLE news ADD COLUMN IF NOT EXISTS source_tier smallint DEFAULT 2`);
    await queryRunner.query(`ALTER TABLE news ADD COLUMN IF NOT EXISTS unconfirmed boolean DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE news DROP COLUMN IF EXISTS unconfirmed`);
    await queryRunner.query(`ALTER TABLE news DROP COLUMN IF EXISTS source_tier`);
    await queryRunner.query(`ALTER TABLE news DROP COLUMN IF EXISTS time_horizon`);
    await queryRunner.query(`ALTER TABLE news DROP COLUMN IF EXISTS affected_sectors`);
    await queryRunner.query(`ALTER TABLE news DROP COLUMN IF EXISTS affected_assets`);
    await queryRunner.query(`ALTER TABLE news DROP COLUMN IF EXISTS impact_thesis`);
    await queryRunner.query(`ALTER TABLE news DROP COLUMN IF EXISTS impact_score`);
  }
}
