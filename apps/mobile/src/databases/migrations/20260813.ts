import type { MigrationInterface, QueryRunner } from 'typeorm/browser';

import { APP_DB_PREFIX, ORM_TABLE_NAMES } from '../constant';

const snapshotTable = `${APP_DB_PREFIX}${ORM_TABLE_NAMES.projection_snapshot_legacy}`;
const itemTable = `${APP_DB_PREFIX}${ORM_TABLE_NAMES.projection_item_legacy}`;
const groupItemTable = `${APP_DB_PREFIX}${ORM_TABLE_NAMES.projection_group_item_legacy}`;

export class CreateAssetProjectionTables1786566000000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${snapshotTable}" (
        "_db_id" text PRIMARY KEY NOT NULL,
        "projection_key" text NOT NULL,
        "generation" integer NOT NULL,
        "projection_kind" text NOT NULL,
        "scene" text NOT NULL,
        "rule_version" integer NOT NULL,
        "item_count" integer NOT NULL,
        "group_item_count" integer NOT NULL,
        "metadata_json" text NOT NULL DEFAULT ('{}'),
        "committed_at" integer NOT NULL
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_projection_snapshot_key_generation" ON "${snapshotTable}" ("projection_key", "generation")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_projection_snapshot_committed_at" ON "${snapshotTable}" ("committed_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${itemTable}" (
        "_db_id" text PRIMARY KEY NOT NULL,
        "projection_key" text NOT NULL,
        "generation" integer NOT NULL,
        "position" integer NOT NULL,
        "row_type" text NOT NULL,
        "row_id" text NOT NULL
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_projection_item_key_generation_position" ON "${itemTable}" ("projection_key", "generation", "position")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_projection_item_row_id" ON "${itemTable}" ("row_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${groupItemTable}" (
        "_db_id" text PRIMARY KEY NOT NULL,
        "projection_key" text NOT NULL,
        "generation" integer NOT NULL,
        "group_id" text NOT NULL,
        "position" integer NOT NULL,
        "member_id" text NOT NULL
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_projection_group_item_key_generation_group_position" ON "${groupItemTable}" ("projection_key", "generation", "group_id", "position")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_projection_group_item_member_id" ON "${groupItemTable}" ("member_id")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "${groupItemTable}"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "${itemTable}"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "${snapshotTable}"`);
  }
}
