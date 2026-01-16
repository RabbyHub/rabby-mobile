import { MigrationInterface, QueryRunner } from 'typeorm/browser';
import { APP_DB_PREFIX } from '../constant';

const tablesToDrop = [
  `${APP_DB_PREFIX}copy_trading_buyitem`,
  `${APP_DB_PREFIX}cache_swapitem`,
  `${APP_DB_PREFIX}cache_localhistoryitem`,
];

async function checkIfTableExists(queryRunner: QueryRunner, tableName: string) {
  const tableExists = await queryRunner.query(
    `
    SELECT 1 FROM sqlite_master WHERE type='table' AND name=?;
  `,
    [tableName],
  );

  return tableExists.length > 0;
}

export class CleanupTables1768475805228 implements MigrationInterface {
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const tokenTableName of tablesToDrop) {
      const tableExists = await checkIfTableExists(queryRunner, tokenTableName);
      if (tableExists) {
        await queryRunner.query(`DROP TABLE '${tokenTableName}'`);
      }
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {}
}
