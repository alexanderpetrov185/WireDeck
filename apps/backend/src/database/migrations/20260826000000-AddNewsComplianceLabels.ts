import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint 19: колонка compliance_labels для маркировки новостей по watchlists
 * (foreign_agent / terror_extremist / undesirable_org).
 * Хранит comma-separated ключи категорий; NULL = clean.
 * Идемпотентная: ADD COLUMN IF NOT EXISTS.
 */
export class AddNewsComplianceLabels20260826000000 implements MigrationInterface {
  name = 'AddNewsComplianceLabels20260826000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE news ADD COLUMN IF NOT EXISTS compliance_labels varchar(255)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE news DROP COLUMN IF EXISTS compliance_labels
    `);
  }
}