import {
  EMPTY_TOKEN_ITEM_ID,
  LEGACY_REAL_STORAGE_RATIO,
  makeTokenCacheRows,
} from './tokenRows';

describe('token cache rows', () => {
  it('matches the current token entity storage contract', () => {
    const [row] = makeTokenCacheRows(
      '0xABC',
      [
        {
          id: 'token',
          chain: 'eth',
          inner_id: 'position',
          amount: 2.5,
          price: 3,
          raw_amount: '250',
          cex_ids: ['binance'],
          launchpad: { id: 'launchpad' },
        },
      ],
      123,
    );

    expect(row.owner_addr).toBe('0xabc');
    expect(row._db_id).toBe('0xabc-token-eth-position');
    expect(row.projection_resource_id).toBe('0xabc:eth:token');
    expect(row.amount).toBe(2.5 * LEGACY_REAL_STORAGE_RATIO);
    expect(row.price).toBe(3 * LEGACY_REAL_STORAGE_RATIO);
    expect(row.raw_amount).toBe('250');
    expect(row.cex_ids).toBe('["binance"]');
    expect(row.launchpad).toBe('{"id":"launchpad"}');
  });

  it('persists an empty sentinel for a complete empty snapshot', () => {
    const [row] = makeTokenCacheRows('0xabc', [], 123);

    expect(row.id).toBe(EMPTY_TOKEN_ITEM_ID);
    expect(row.chain).toBe(EMPTY_TOKEN_ITEM_ID);
    expect(row._db_id).toBe(
      `0xabc-${EMPTY_TOKEN_ITEM_ID}-${EMPTY_TOKEN_ITEM_ID}`,
    );
  });
});
