import type { MigrationInterface, QueryRunner } from 'typeorm/browser';

import { APP_DB_PREFIX, ORM_TABLE_NAMES } from '../constant';

const legacyProtocolTableName = `${APP_DB_PREFIX}${ORM_TABLE_NAMES.cache_portocolitem_legacy}`;

async function tableExists(queryRunner: QueryRunner, tableName: string) {
  const rows: unknown[] = await queryRunner.query(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
    [tableName],
  );
  return rows.length > 0;
}

export class ReplaceProtocolCacheTable1786953600000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await tableExists(queryRunner, legacyProtocolTableName))) {
      return;
    }

    // Protocol rows are remote cache data. The replacement schema carries
    // normalized projection fields, so rebuilding is safer than backfilling
    // summaries from an arbitrarily large legacy JSON cache at launch.
    await queryRunner.query(`DROP TABLE "${legacyProtocolTableName}"`);
  }

  async down(): Promise<void> {
    // Cache data is intentionally rebuilt rather than restored.
  }
}
