import { MigrationInterface, QueryRunner } from 'typeorm/browser';
import { APP_DB_PREFIX } from '../constant';

export class SQLiteRenameTablesAddress1737013742818
  implements MigrationInterface
{
  // transaction = true;

  // rename `address` column to `address` in `tokenitem`, `ntfitem`, `historyitem`
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE '${APP_DB_PREFIX}tokenitem' RENAME COLUMN address TO 'owner_addr';
      ALTER TABLE '${APP_DB_PREFIX}nftitem' RENAME COLUMN 'address' TO 'owner_addr';
      ALTER TABLE '${APP_DB_PREFIX}historyitem' RENAME COLUMN 'address' TO 'owner_addr';
      ALTER TABLE '${APP_DB_PREFIX}swapitem' RENAME COLUMN 'address' TO 'owner_addr';
  `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE '${APP_DB_PREFIX}tokenitem' RENAME COLUMN 'owner_addr' TO 'address';
      ALTER TABLE '${APP_DB_PREFIX}nftitem' RENAME COLUMN 'owner_addr' TO 'address';
      ALTER TABLE '${APP_DB_PREFIX}historyitem' RENAME COLUMN 'owner_addr' TO 'address';
      ALTER TABLE '${APP_DB_PREFIX}swapitem' RENAME COLUMN 'owner_addr' TO 'address';
  `);
  }
}
