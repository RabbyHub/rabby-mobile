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

type TransferItem = {
  token_id: string;
  amount: number;
  price?: number;
  token?: {
    is_core?: boolean;
    is_verified?: boolean;
    price?: number;
    collection?: unknown;
  } | null;
};

// frozen copy of HistoryItemEntity.judgeIsSmallUsdTx at migration time,
// minus the pinedQueue check: its absence only biases toward "small",
// and this migration only flips rows from small to not-small
function judgeIsSmallUsdTx(row: {
  tx_from_address: string;
  owner_addr: string;
  receives: TransferItem[];
  sends: TransferItem[];
}) {
  if (row.tx_from_address.toLowerCase() === row.owner_addr.toLowerCase()) {
    return false;
  }

  const transfers = [...(row.receives || []), ...(row.sends || [])];

  if (!transfers.length) {
    return true;
  }
  let allUsd = 0;

  for (const i of transfers) {
    const token = i.token;
    const tokenIsNft = i.token_id?.length === 32;
    if (tokenIsNft) {
      if (!token || !token.collection) {
        return true;
      } else {
        return false;
      }
    }
    const isCore = token?.is_core || token?.is_verified;
    const price = isCore ? i?.price || token?.price || 0 : 0;
    allUsd += i.amount * price;
  }

  if (allUsd < 0.1) {
    return true;
  }

  return false;
}

// re-judge is_small_tx after including sends in judgeIsSmallUsdTx:
// only rows currently marked small and having sends can flip to not-small
export class UpdateHistoryRejudgeSmallTx1785297040800
  implements MigrationInterface
{
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await checkIfTableExists(queryRunner, historyTableName);
    if (!tableExists) {
      return;
    }

    // upgrades from builds older than a6a7a5e99 have the table without the
    // is_small_tx column (it is added by the post-migration schema sync), and
    // their legacy rows were already wiped by UpdateHistoryTableRestart
    const columns: { name: string }[] = await queryRunner.query(
      `PRAGMA table_info('${historyTableName}')`,
    );
    if (!columns.some(c => c.name === 'is_small_tx')) {
      return;
    }

    const rows: {
      _db_id: string;
      tx_from_address: string | null;
      owner_addr: string | null;
      receives: string | null;
      sends: string | null;
    }[] = await queryRunner.query(
      `SELECT _db_id, tx_from_address, owner_addr, receives, sends FROM '${historyTableName}' WHERE is_small_tx = 1 AND sends IS NOT NULL AND sends != '[]'`,
    );

    const unhideIds: string[] = [];
    for (const row of rows) {
      try {
        const isSmall = judgeIsSmallUsdTx({
          tx_from_address: row.tx_from_address || '',
          owner_addr: row.owner_addr || '',
          receives: JSON.parse(row.receives || '[]'),
          sends: JSON.parse(row.sends || '[]'),
        });
        if (!isSmall) {
          unhideIds.push(row._db_id);
        }
      } catch (e) {
        console.error('rejudge is_small_tx error', e, row._db_id);
      }
    }

    const CHUNK_SIZE = 200;
    for (let i = 0; i < unhideIds.length; i += CHUNK_SIZE) {
      const chunk = unhideIds.slice(i, i + CHUNK_SIZE);
      await queryRunner.query(
        `UPDATE '${historyTableName}' SET is_small_tx = 0 WHERE _db_id IN (${chunk
          .map(() => '?')
          .join(',')})`,
        chunk,
      );
    }
  }

  async down(): Promise<void> {
    // previous is_small_tx values are not recoverable
  }
}
