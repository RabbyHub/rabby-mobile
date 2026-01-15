import { MigrationInterface, QueryRunner } from 'typeorm/browser';
import { APP_DB_PREFIX } from '../constant';

const tokenTableName = `${APP_DB_PREFIX}copy_trading_buyitem`;

async function checkIfTableExists(queryRunner: QueryRunner, tableName: string) {
  const tableExists = await queryRunner.query(
    `
    SELECT 1 FROM sqlite_master WHERE type='table' AND name=?;
  `,
    [tableName],
  );

  return tableExists.length > 0;
}

export class RemoveCopyTradingTable1768463711916 implements MigrationInterface {
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await checkIfTableExists(queryRunner, tokenTableName);
    if (tableExists) {
      await queryRunner.query(`DROP TABLE '${tokenTableName}'`);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {}
}
