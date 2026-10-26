import type { MigrationInterface, QueryRunner } from 'typeorm/browser';

import { APP_DB_PREFIX, ORM_TABLE_NAMES } from '../constant';

const legacyNftTable = `${APP_DB_PREFIX}${ORM_TABLE_NAMES.cache_nftitem_legacy}`;

async function tableExists(queryRunner: QueryRunner, tableName: string) {
  const rows: unknown[] = await queryRunner.query(
    `SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`,
    [tableName],
  );
  return rows.length > 0;
}

export class ReplaceNftCacheTable1786566001000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await tableExists(queryRunner, legacyNftTable))) {
      return;
    }
    // The legacy cache contains collection ids written from contract_id.
    // Drop it instead of migrating ambiguous rows; synchronize(false) creates
    // the dated replacement table and the normal asset flow repopulates it.
    await queryRunner.query(`DROP TABLE "${legacyNftTable}"`);
  }

  async down(): Promise<void> {
    // Cache data is intentionally rebuilt rather than restored.
  }
}
