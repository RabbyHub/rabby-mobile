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
  },
): DisplayNftItem =>
  ({
    id,
    inner_id: `${id}-inner`,
    owner_addr: '0xABC',
    chain: 'eth',
    name: id,
    amount: 1,
    collection_id: options?.collectionId,
    collection: options?.collectionId
      ? {
          id: options.collectionId,
          name: `collection-${options.collectionId}`,
          chain: 'eth',
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

    expect(projection.result.unFoldRows).toHaveLength(1);
    expect(projection.result.unFoldRows[0]?.type).toBe('collection');
    expect(projection.collections[0]?.value.nft_list).toHaveLength(2);
  });

  it('keeps folded and unfolded rows independent', () => {
    const projection = buildNftAssetsIndexProjection(
      [makeNft('visible'), makeNft('hidden', { fold: true })],
      '0xabc::eth',
    );

    expect(projection.result.unFoldRows).toHaveLength(1);
    expect(projection.result.foldRows).toHaveLength(1);
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
    expect(second.result.unFoldRows).toBe(first.result.unFoldRows);
  });
});
