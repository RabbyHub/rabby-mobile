import { MigrationInterface, QueryRunner } from 'typeorm/browser';
import { APP_DB_PREFIX } from '../constant';

const buyTableName = `${APP_DB_PREFIX}historyitem`;

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
    const tableExists = await checkIfTableExists(queryRunner, buyTableName);
    if (tableExists) {
      await queryRunner.query(
        `ALTER TABLE '${buyTableName}' ADD COLUMN historyItemCateType TEXT`,
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await checkIfTableExists(queryRunner, buyTableName);
    if (tableExists) {
      await queryRunner.query(
        `ALTER TABLE '${buyTableName}' DROP COLUMN historyItemCateType`,
      );
    }
  }
}
