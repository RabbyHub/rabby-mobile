import {
  buildTokenSnapshotMutationCommands,
  TOKEN_CACHE_UPSERT_SQL,
} from './tokenPersistencePlan';
import { makeTokenCacheRow, TOKEN_CACHE_COLUMNS } from './tokenRows';

const ADDRESS = '0xabc';
const GENERATION = 1234;

describe('token persistence plan', () => {
  test('replaces one complete address after upserting its rows', () => {
    const row = makeTokenCacheRow(
      ADDRESS,
      { id: 'eth', chain: 'eth', is_core: true },
      GENERATION,
    );
    const commands = buildTokenSnapshotMutationCommands({
      address: ADDRESS.toUpperCase(),
      syncTimestamp: GENERATION,
      replacementScope: 'address',
      chainIds: ['eth'],
      rows: [row],
    });

    expect(commands).toHaveLength(2);
    expect(commands[0][0]).toBe(TOKEN_CACHE_UPSERT_SQL);
    expect(commands[0][1]).toHaveLength(TOKEN_CACHE_COLUMNS.length);
    expect(commands[0][1][TOKEN_CACHE_COLUMNS.indexOf('is_core')]).toBe(1);
    expect(commands[1][0]).toContain('"owner_addr"=?');
    expect(commands[1][1]).toEqual([ADDRESS, GENERATION]);
  });

  test('replaces only successful chains and removes a stale empty sentinel', () => {
    const row = makeTokenCacheRow(
      ADDRESS,
      { id: 'arb', chain: 'arb' },
      GENERATION,
    );
    const commands = buildTokenSnapshotMutationCommands({
      address: ADDRESS,
      syncTimestamp: GENERATION,
      replacementScope: 'chains',
      chainIds: ['arb', 'arb'],
      rows: [row],
    });

    expect(commands).toHaveLength(3);
    expect(commands[1][0]).toContain('"chain" IN (?)');
    expect(commands[1][1]).toEqual([ADDRESS, 'arb', GENERATION]);
    expect(commands[2][0]).toContain('"id"=?');
  });

  test('rejects rows outside the declared address or chain scope', () => {
    const wrongAddress = makeTokenCacheRow(
      '0xdef',
      { id: 'eth', chain: 'eth' },
      GENERATION,
    );
    expect(() =>
      buildTokenSnapshotMutationCommands({
        address: ADDRESS,
        syncTimestamp: GENERATION,
        replacementScope: 'address',
        chainIds: [],
        rows: [wrongAddress],
      }),
    ).toThrow('snapshot_scope_mismatch');

    const wrongChain = makeTokenCacheRow(
      ADDRESS,
      { id: 'eth', chain: 'eth' },
      GENERATION,
    );
    expect(() =>
      buildTokenSnapshotMutationCommands({
        address: ADDRESS,
        syncTimestamp: GENERATION,
        replacementScope: 'chains',
        chainIds: ['arb'],
        rows: [wrongChain],
      }),
    ).toThrow('snapshot_chain_mismatch');
  });
});
