import { MigrationInterface, QueryRunner } from 'typeorm/browser';
import { APP_DB_PREFIX } from '../constant';

const tokenTableName = `${APP_DB_PREFIX}cache_tokenitem`;

async function checkIfTableExists(queryRunner: QueryRunner, tableName: string) {
  const tableExists = await queryRunner.query(
    `
    SELECT 1 FROM sqlite_master WHERE type='table' AND name=?;
  `,
    [tableName],
  );

  return tableExists.length > 0;
}

export class UpdateTokenItemAddCexIds1743518329613
  implements MigrationInterface
{
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await checkIfTableExists(queryRunner, tokenTableName);
    if (tableExists) {
      await queryRunner.query(`DELETE FROM '${tokenTableName}'`);
      await queryRunner.query(
        `ALTER TABLE '${tokenTableName}' ADD COLUMN cex_ids TEXT DEFAULT '[]'`,
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await checkIfTableExists(queryRunner, tokenTableName);
    if (tableExists) {
      await queryRunner.query(
        `ALTER TABLE '${tokenTableName}' DROP COLUMN cex_ids`,
      );
    }
  }
}
