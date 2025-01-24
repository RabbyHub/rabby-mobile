import { MigrationInterface, QueryRunner } from 'typeorm/browser';
import { APP_DB_PREFIX } from '../constant';

const dbTables = ['tokenitem', 'nftitem', 'historyitem', 'swapitem'];

async function checkIfTableExists(queryRunner: QueryRunner, tableName: string) {
  const tableExists = await queryRunner.query(
    `
    SELECT 1 FROM sqlite_master WHERE type='table' AND name=?;
  `,
    [tableName],
  );

  return tableExists.length > 0;
}

export class SQLiteRenameTablesAddress1737013742818
  implements MigrationInterface
{
  transaction = false;

  // rename `address` column to `address` in `tokenitem`, `ntfitem`, `historyitem`
  async up(queryRunner: QueryRunner): Promise<void> {
    Promise.all(
      dbTables.map(async tableName => {
        const tableExists = await checkIfTableExists(queryRunner, tableName);
        if (!tableExists) return;

        await queryRunner.query(`
        ALTER TABLE '${APP_DB_PREFIX}${tableName}' RENAME COLUMN 'address' TO 'owner_addr';
      `);
      }),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    Promise.all(
      dbTables.map(async tableName => {
        const tableExists = await checkIfTableExists(queryRunner, tableName);
        if (!tableExists) return;

        await queryRunner.query(`
        ALTER TABLE '${APP_DB_PREFIX}${tableName}' RENAME COLUMN 'owner_addr' TO 'address';
      `);
      }),
    );
  }
}
