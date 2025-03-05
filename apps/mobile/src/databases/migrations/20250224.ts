import { MigrationInterface, QueryRunner } from 'typeorm/browser';
import { APP_DB_PREFIX } from '../constant';

const buyTableName = `${APP_DB_PREFIX}cache_buyitem`;

async function checkIfTableExists(queryRunner: QueryRunner, tableName: string) {
  const tableExists = await queryRunner.query(
    `
    SELECT 1 FROM sqlite_master WHERE type='table' AND name=?;
  `,
    [tableName],
  );

  return tableExists.length > 0;
}

export class UpdateBuyTableAddPayCurrency1740378323012
  implements MigrationInterface
{
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await checkIfTableExists(queryRunner, buyTableName);
    if (tableExists) {
      await queryRunner.query(`DELETE FROM '${buyTableName}'`);
      await queryRunner.query(
        `ALTER TABLE '${buyTableName}' ADD COLUMN pay_currency_code TEXT`,
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await checkIfTableExists(queryRunner, buyTableName);
    if (tableExists) {
      await queryRunner.query(
        `ALTER TABLE '${buyTableName}' DROP COLUMN pay_currency_code`,
      );
    }
  }
}
