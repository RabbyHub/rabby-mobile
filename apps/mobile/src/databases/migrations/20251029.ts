import { MigrationInterface, QueryRunner } from 'typeorm/browser';
import { APP_DB_PREFIX } from '../constant';

const historyTableName = `${APP_DB_PREFIX}cache_historyitem`;

async function checkIfTableExists(queryRunner: QueryRunner, tableName: string) {
  const tableExists = await queryRunner.query(
    `
    SELECT 1 FROM sqlite_master WHERE type='table' AND name=?;
  `,
    [tableName],
  );

  return tableExists.length > 0;
}

export class UpdateHistoryTableAddCustomType1761706571381
  implements MigrationInterface
{
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await checkIfTableExists(queryRunner, historyTableName);
    if (tableExists) {
      await queryRunner.query(
        `ALTER TABLE '${historyTableName}' ADD COLUMN history_custom_type TEXT DEFAULT ''`,
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await checkIfTableExists(queryRunner, historyTableName);
    if (tableExists) {
      await queryRunner.query(
        `ALTER TABLE '${historyTableName}' DROP COLUMN history_custom_type`,
      );
    }
  }
}
