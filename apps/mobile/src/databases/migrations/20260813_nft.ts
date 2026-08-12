import type { MigrationInterface, QueryRunner } from 'typeorm/browser';

import { APP_DB_PREFIX, ORM_TABLE_NAMES } from '../constant';

const nftTable = `${APP_DB_PREFIX}${ORM_TABLE_NAMES.cache_nftitem}`;

async function tableExists(queryRunner: QueryRunner, tableName: string) {
  const rows: unknown[] = await queryRunner.query(
    `SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`,
    [tableName],
  );
  return rows.length > 0;
}

export class RepairNftCollectionId1786566001000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await tableExists(queryRunner, nftTable))) {
      return;
    }

    const rows: Array<{
      _db_id: string;
      chain: string | null;
      contract_id: string | null;
      collection_id: string | null;
      collection: string | null;
    }> = await queryRunner.query(
      `SELECT _db_id, chain, contract_id, collection_id, collection FROM "${nftTable}"`,
    );
    const updates: Array<[string, string]> = [];

    rows.forEach(row => {
      let collectionChain = row.chain || '';
      let collectionId = '';
      try {
        const collection = JSON.parse(row.collection || '{}') as {
          chain?: unknown;
          id?: unknown;
        };
        if (typeof collection.chain === 'string') {
          collectionChain = collection.chain;
        }
        if (typeof collection.id === 'string') {
          collectionId = collection.id;
        }
      } catch {
        // Fall through to the contract-based recovery below.
      }

      const recoveredCollectionId =
        collectionChain && (collectionId || row.contract_id)
          ? `${collectionChain}:${collectionId || row.contract_id}`
          : '';
      if (
        recoveredCollectionId &&
        recoveredCollectionId !== row.collection_id
      ) {
        updates.push([recoveredCollectionId, row._db_id]);
      }
    });

    const chunkSize = 200;
    for (let offset = 0; offset < updates.length; offset += chunkSize) {
      const chunk = updates.slice(offset, offset + chunkSize);
      const cases = chunk.map(() => 'WHEN ? THEN ?').join(' ');
      const ids = chunk.map(() => '?').join(', ');
      await queryRunner.query(
        `UPDATE "${nftTable}" SET collection_id = CASE _db_id ${cases} END WHERE _db_id IN (${ids})`,
        [
          ...chunk.flatMap(([collectionId, dbId]) => [dbId, collectionId]),
          ...chunk.map(([, dbId]) => dbId),
        ],
      );
    }
  }

  async down(): Promise<void> {
    // The previous incorrect collection ids cannot be reconstructed safely.
  }
}
