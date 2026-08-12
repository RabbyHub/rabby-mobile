import type { DisplayNftItem } from '@/types/assets';
import {
  buildNftAssetsIndexProjection,
  buildNftEntityId,
} from './nftAssetsIndex';

const makeNft = (
  id: string,
  options?: {
    collectionId?: string;
    chain?: string;
    fold?: boolean;
    ownerAddress?: string;
    creditScore?: number;
  },
): DisplayNftItem =>
  ({
    id,
    inner_id: `${id}-inner`,
    owner_addr: options?.ownerAddress || '0xABC',
    chain: options?.chain || 'eth',
    name: id,
    amount: 1,
    collection_id: options?.collectionId,
    collection: options?.collectionId
      ? {
          id: options.collectionId,
          name: `collection-${options.collectionId}`,
          chain: options?.chain || 'eth',
          credit_score: options.creditScore || 0,
          nft_list: [],
        }
      : null,
    _isFold: options?.fold,
  } as unknown as DisplayNftItem);

describe('nft asset index', () => {
  it('builds a stable identity from owner and NFT identity fields', () => {
    expect(
      buildNftEntityId(makeNft('one', { collectionId: 'collection' })),
    ).toBe('0xabc:eth:collection:one:one-inner');
  });

  it('keeps the same NFT identity isolated across owners', () => {
    const first = buildNftEntityId(
      makeNft('one', { collectionId: 'collection', ownerAddress: '0xAAA' }),
    );
    const second = buildNftEntityId(
      makeNft('one', { collectionId: 'collection', ownerAddress: '0xBBB' }),
    );

    expect(first).not.toBe(second);
    expect(first.startsWith('0xaaa:')).toBe(true);
    expect(second.startsWith('0xbbb:')).toBe(true);
  });

  it('uses the injected address when legacy NFT values omit owner_addr', () => {
    const nft = makeNft('one', { collectionId: 'collection' }) as unknown as {
      owner_addr?: string;
      address?: string;
      chain: string;
      id: string;
      inner_id: string;
      collection_id: string;
    };
    delete nft.owner_addr;
    nft.address = '0xDEF';

    expect(buildNftEntityId(nft)).toBe('0xdef:eth:collection:one:one-inner');
  });

  it('groups collection members into one row', () => {
    const projection = buildNftAssetsIndexProjection(
      [
        makeNft('one', { collectionId: 'collection' }),
        makeNft('two', { collectionId: 'collection' }),
      ],
      '0xabc::eth',
    );

    expect(projection.result.rows).toHaveLength(1);
    expect(projection.result.rows[0]?.type).toBe('collection');
    expect(projection.collections[0]?.value.nft_list).toHaveLength(2);
  });

  it('keeps the same collection separate across owners', () => {
    const projection = buildNftAssetsIndexProjection(
      [
        makeNft('one', {
          collectionId: 'collection',
          ownerAddress: '0xAAA',
        }),
        makeNft('two', {
          collectionId: 'collection',
          ownerAddress: '0xBBB',
        }),
      ],
      'multi::0xaaa|0xbbb::eth',
    );

    expect(projection.result.rows).toHaveLength(2);
    expect(projection.collections.map(item => item.value.address)).toEqual([
      '0xaaa',
      '0xbbb',
    ]);
  });

  it('normalizes collection identity before grouping members', () => {
    const projection = buildNftAssetsIndexProjection(
      [
        makeNft('one', {
          collectionId: 'Collection',
          chain: 'ETH',
          ownerAddress: '0xABC',
        }),
        makeNft('two', {
          collectionId: 'collection',
          chain: 'eth',
          ownerAddress: '0xabc',
        }),
      ],
      '0xabc::eth',
    );

    expect(projection.result.rows).toEqual([
      {
        type: 'collection',
        collectionId: '0xabc::eth::collection',
      },
    ]);
    expect(projection.collections).toHaveLength(1);
    expect(projection.collections[0]?.value.nft_list).toHaveLength(2);
  });

  it('does not hide rows based on the legacy fold flag', () => {
    const projection = buildNftAssetsIndexProjection(
      [makeNft('visible'), makeNft('hidden', { fold: true })],
      '0xabc::eth',
    );

    expect(projection.result.rows).toHaveLength(2);
  });

  it('sorts collection rows by credit score', () => {
    const projection = buildNftAssetsIndexProjection(
      [
        makeNft('low', { collectionId: 'low', creditScore: 1 }),
        makeNft('high', { collectionId: 'high', creditScore: 100 }),
      ],
      '0xabc::eth',
    );

    expect(projection.collections.map(item => item.value.id)).toEqual([
      'low',
      'high',
    ]);
    expect(projection.result.rows[0]).toEqual({
      type: 'collection',
      collectionId: '0xabc::eth::high',
    });
  });

  it('preserves the previous row order when credit scores tie', () => {
    const first = buildNftAssetsIndexProjection(
      [
        makeNft('first', { collectionId: 'first', creditScore: 10 }),
        makeNft('second', { collectionId: 'second', creditScore: 5 }),
      ],
      '0xabc::eth',
    );
    const second = buildNftAssetsIndexProjection(
      [
        makeNft('second', { collectionId: 'second', creditScore: 10 }),
        makeNft('first', { collectionId: 'first', creditScore: 10 }),
      ],
      '0xabc::eth',
      first.result,
    );

    expect(second.result.rows).toEqual(first.result.rows);
    expect(second.result).toBe(first.result);
  });

  it('sorts collection members deterministically by normalized entity id', () => {
    const first = buildNftAssetsIndexProjection(
      [
        makeNft('zeta', { collectionId: 'collection' }),
        makeNft('alpha', { collectionId: 'collection' }),
      ],
      '0xabc::eth',
    );
    const second = buildNftAssetsIndexProjection(
      [
        makeNft('alpha', { collectionId: 'collection' }),
        makeNft('zeta', { collectionId: 'collection' }),
      ],
      '0xabc::eth',
    );

    const ids = (projection: typeof first) =>
      projection.collections[0]?.value.nft_list.map(buildNftEntityId);
    expect(ids(first)).toEqual(ids(second));
    expect(ids(first)).toEqual([
      '0xabc:eth:collection:alpha:alpha-inner',
      '0xabc:eth:collection:zeta:zeta-inner',
    ]);
  });

  it('reuses row arrays and the result when ids and ordering are unchanged', () => {
    const first = buildNftAssetsIndexProjection(
      [makeNft('one'), makeNft('two', { collectionId: 'collection' })],
      '0xabc::eth',
    );
    const second = buildNftAssetsIndexProjection(
      [makeNft('one'), makeNft('two', { collectionId: 'collection' })],
      '0xabc::eth',
      first.result,
    );

    expect(second.result).toBe(first.result);
    expect(second.result.rows).toBe(first.result.rows);
  });
});
