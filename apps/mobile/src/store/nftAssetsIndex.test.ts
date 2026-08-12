import type { DisplayNftItem } from '@/types/assets';
import {
  buildNftAssetsIndexProjection,
  buildNftEntityId,
} from './nftAssetsIndex';

const makeNft = (
  id: string,
  options?: {
    collectionId?: string;
    fold?: boolean;
    ownerAddress?: string;
    creditScore?: number;
  },
): DisplayNftItem =>
  ({
    id,
    inner_id: `${id}-inner`,
    owner_addr: options?.ownerAddress || '0xABC',
    chain: 'eth',
    name: id,
    amount: 1,
    collection_id: options?.collectionId,
    collection: options?.collectionId
      ? {
          id: options.collectionId,
          name: `collection-${options.collectionId}`,
          chain: 'eth',
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
