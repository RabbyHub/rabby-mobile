import type { MigrationInterface, QueryRunner } from 'typeorm/browser';

import { APP_DB_PREFIX, ORM_TABLE_NAMES } from '../constant';

const legacyTokenTableName = `${APP_DB_PREFIX}${ORM_TABLE_NAMES.cache_tokenitem_legacy}`;

const tableExists = async (queryRunner: QueryRunner, tableName: string) => {
  const rows = await queryRunner.query(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
    [tableName],
  );
  return rows.length > 0;
};

export class ReplaceTokenCacheTable1786867200000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await tableExists(queryRunner, legacyTokenTableName))) {
      return;
    }

    // Token rows are remote cache data. Rebuilding the dated table is cheaper
    // and safer than copying or backfilling a potentially multi-gigabyte
    // legacy cache during application startup. synchronize(false) creates the
    // replacement table and its projection lookup index after migrations.
    await queryRunner.query(`DROP TABLE "${legacyTokenTableName}"`);
  }

  async down(): Promise<void> {
    // Cache data is intentionally rebuilt rather than restored.
  }
}
