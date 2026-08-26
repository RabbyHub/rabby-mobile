/* eslint-disable jsdoc/require-param, jsdoc/require-returns */

import {
  EMPTY_TOKEN_ITEM_ID,
  TOKEN_CACHE_COLUMNS,
  TOKEN_CACHE_TABLE_NAME,
  type TokenCacheRow,
  type TokenCacheScalar,
} from './tokenRows';

export type TokenPersistenceCommand = [string, TokenCacheScalar[]];

export type TokenSnapshotMutationInput = {
  address: string;
  syncTimestamp: number;
  replacementScope: 'address' | 'chains';
  chainIds: string[];
  rows: TokenCacheRow[];
};

const quote = (identifier: string) => `"${identifier}"`;
const quotedTable = quote(TOKEN_CACHE_TABLE_NAME);

export const TOKEN_CACHE_UPSERT_SQL = (() => {
  const columns = TOKEN_CACHE_COLUMNS.map(quote).join(',');
  const values = TOKEN_CACHE_COLUMNS.map(() => '?').join(',');
  const updates = TOKEN_CACHE_COLUMNS.filter(
    column => column !== '_local_created_at' && column !== '_db_id',
  )
    .map(column => `${quote(column)}=excluded.${quote(column)}`)
    .join(',');
  return `INSERT INTO ${quotedTable} (${columns}) VALUES (${values}) ON CONFLICT (${quote(
    '_db_id',
  )}) DO UPDATE SET ${updates}`;
})();

function normalizeScalar(value: TokenCacheScalar): TokenCacheScalar {
  return typeof value === 'boolean' ? Number(value) : value;
}

function assertSnapshot(input: TokenSnapshotMutationInput) {
  const address = input.address.toLowerCase();
  const chainIds = Array.from(new Set(input.chainIds.filter(Boolean)));
  if (
    !address ||
    !Number.isSafeInteger(input.syncTimestamp) ||
    input.syncTimestamp <= 0 ||
    (input.replacementScope === 'address' && input.rows.length === 0) ||
    (input.replacementScope === 'chains' && chainIds.length === 0)
  ) {
    throw new Error('worker_asset_store_invalid_snapshot');
  }

  const chainIdSet = new Set(chainIds);
  input.rows.forEach(row => {
    if (row.owner_addr !== address) {
      throw new Error('snapshot_scope_mismatch');
    }
    if (
      input.replacementScope === 'chains' &&
      !chainIdSet.has(String(row.chain))
    ) {
      throw new Error('snapshot_chain_mismatch');
    }
  });

  return { address, chainIds };
}

/** Build the atomic token-cache mutation after its generation fence passes. */
export function buildTokenSnapshotMutationCommands(
  input: TokenSnapshotMutationInput,
): TokenPersistenceCommand[] {
  const { address, chainIds } = assertSnapshot(input);
  const commands: TokenPersistenceCommand[] = input.rows.map(row => [
    TOKEN_CACHE_UPSERT_SQL,
    TOKEN_CACHE_COLUMNS.map(column => normalizeScalar(row[column])),
  ]);

  if (input.replacementScope === 'address') {
    commands.push([
      `DELETE FROM ${quotedTable} WHERE ${quote(
        'owner_addr',
      )}=? AND ${quote('_local_updated_at')}<?`,
      [address, input.syncTimestamp],
    ]);
  } else {
    commands.push([
      `DELETE FROM ${quotedTable} WHERE ${quote(
        'owner_addr',
      )}=? AND ${quote('chain')} IN (${chainIds
        .map(() => '?')
        .join(',')}) AND ${quote('_local_updated_at')}<?`,
      [address, ...chainIds, input.syncTimestamp],
    ]);
    if (input.rows.length > 0) {
      commands.push([
        `DELETE FROM ${quotedTable} WHERE ${quote(
          'owner_addr',
        )}=? AND ${quote('id')}=?`,
        [address, EMPTY_TOKEN_ITEM_ID],
      ]);
    }
  }

  return commands;
}
