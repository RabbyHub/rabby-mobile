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

export class ClearTokenItemForNullablePrice24hChange1773132444267
  implements MigrationInterface
{
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await checkIfTableExists(queryRunner, tokenTableName);
    if (tableExists) {
      // This is a cache table; drop it so synchronize(false) recreates it.
      await queryRunner.query(`DROP TABLE '${tokenTableName}'`);
    }
  }

  async down(_queryRunner: QueryRunner): Promise<void> {}
}
