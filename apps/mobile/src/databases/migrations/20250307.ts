import { MigrationInterface, QueryRunner } from 'typeorm/browser';
import { APP_DB_PREFIX } from '../constant';

const historyTableName = 'historyitem';

async function checkIfTableExists(queryRunner: QueryRunner, tableName: string) {
  const tableExists = await queryRunner.query(
    `
    SELECT 1 FROM sqlite_master WHERE type='table' AND name=?;
  `,
    [tableName],
  );

  return tableExists.length > 0;
}

export class UpdateHistoryTableAddCateType1741315815094
  implements MigrationInterface
{
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    console.debug(
      `EXEC ALTER TABLE '${APP_DB_PREFIX}${historyTableName}' ADD COLUMN historyItemCateType TEXT`,
    );
    const tableExists = await checkIfTableExists(queryRunner, historyTableName);
    if (tableExists) {
      console.debug(
        `EXEC ALTER TABLE '${APP_DB_PREFIX}${historyTableName}' ADD COLUMN historyItemCateType TEXT`,
      );
      await queryRunner.query(
        `ALTER TABLE '${APP_DB_PREFIX}${historyTableName}' ADD COLUMN historyItemCateType TEXT`,
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await checkIfTableExists(queryRunner, historyTableName);
    if (tableExists) {
      await queryRunner.query(
        `ALTER TABLE '${APP_DB_PREFIX}${historyTableName}' DROP COLUMN historyItemCateType`,
      );
    }
  }
}
