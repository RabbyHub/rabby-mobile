import type {
  Collection,
  CollectionList,
} from '@rabby-wallet/rabby-api/dist/types';

import type { DisplayNftItem } from '@/types/assets';

export type CombinedNftItem = DisplayNftItem & {
  address?: string;
  owner_addr?: string;
};

export type NftEntityId = string & {
  readonly __nftEntityId: unique symbol;
};

export type NftCollectionId = string & {
  readonly __nftCollectionId: unique symbol;
};

export type NftAssetsIndexRow =
  | {
      type: 'nft';
      nftId: NftEntityId;
    }
  | {
      type: 'collection';
      collectionId: NftCollectionId;
    };

export type NftCollectionResourceValue = Collection &
  Partial<Omit<CollectionList, keyof Collection | 'chain' | 'nft_list'>> & {
    chain: string;
    nft_list: DisplayNftItem[];
    address?: string;
  };

export type NftAssetsIndexResult = {
  rows: NftAssetsIndexRow[];
};

export type NftAssetsIndexProjection = {
  result: NftAssetsIndexResult;
  collections: Array<{
    collectionId: NftCollectionId;
    value: NftCollectionResourceValue;
  }>;
};

const EMPTY_NFT_ASSETS_INDEX_ROWS: NftAssetsIndexRow[] = [];

export const EMPTY_NFT_ASSETS_INDEX_RESULT: NftAssetsIndexResult = {
  rows: EMPTY_NFT_ASSETS_INDEX_ROWS,
};

const getNftOwnerAddress = (nft: { owner_addr?: string; address?: string }) =>
  (nft.owner_addr || nft.address || '').toLowerCase();

export const buildNftEntityId = (
  nft: Pick<DisplayNftItem, 'chain' | 'id'> & {
    owner_addr?: string;
    address?: string;
    inner_id?: string;
    collection_id?: string;
  },
): NftEntityId =>
  [
    getNftOwnerAddress(nft),
    nft.chain?.toLowerCase() || '',
    nft.collection_id?.toLowerCase() || '',
    nft.id?.toLowerCase() || '',
    nft.inner_id?.toLowerCase() || '',
  ].join(':') as NftEntityId;

const buildNftCollectionId = (
  collection: Pick<NftCollectionResourceValue, 'address' | 'chain' | 'id'>,
): NftCollectionId =>
  [
    collection.address?.toLowerCase() || '',
    collection.chain?.toLowerCase() || '',
    collection.id?.toLowerCase() || '',
  ].join('::') as NftCollectionId;

export const createNftCollectionResourceValue = (
  item: CombinedNftItem,
  address: string,
  nftList: DisplayNftItem[],
): NftCollectionResourceValue => {
  const collection = item.collection;
  if (!collection) {
    throw new Error('NFT collection is required');
  }
  const collectionListFields = collection as Collection &
    Partial<CollectionList>;

  return {
    ...collectionListFields,
    address,
    chain: collectionListFields.chain || item.chain || '',
    nft_list: nftList,
  };
};

export const getNftAssetsIndexRowKey = (row: NftAssetsIndexRow) => {
  if (row.type === 'collection') {
    return `collection-${row.collectionId}`;
  }
  return `nft-${row.nftId}`;
};

const isNftAssetsIndexRowEqual = (
  left: NftAssetsIndexRow | undefined,
  right: NftAssetsIndexRow,
) => {
  if (!left || left.type !== right.type) {
    return false;
  }
  if (left.type === 'collection' && right.type === 'collection') {
    return left.collectionId === right.collectionId;
  }
  return left.type === 'nft' && right.type === 'nft'
    ? left.nftId === right.nftId
    : false;
};

const stabilizeRows = (
  rows: NftAssetsIndexRow[],
  previousRows?: NftAssetsIndexRow[],
) => {
  if (!rows.length) {
    return previousRows?.length
      ? EMPTY_NFT_ASSETS_INDEX_ROWS
      : previousRows || EMPTY_NFT_ASSETS_INDEX_ROWS;
  }
  if (
    previousRows?.length === rows.length &&
    rows.every((row, index) =>
      isNftAssetsIndexRowEqual(previousRows[index], row),
    )
  ) {
    return previousRows;
  }
  return rows;
};

const buildRows = (
  nfts: CombinedNftItem[],
  previousRows?: NftAssetsIndexRow[],
) => {
  const candidates: Array<{
    row: NftAssetsIndexRow;
    creditScore: number;
    stableKey: string;
  }> = [];
  const collections: NftAssetsIndexProjection['collections'] = [];
  const collectionMap = new Map<NftCollectionId, NftCollectionResourceValue>();

  nfts.forEach(item => {
    if (!item.collection_id || !item.collection) {
      const nftId = buildNftEntityId(item);
      candidates.push({
        row: { type: 'nft', nftId },
        creditScore: 0,
        stableKey: `nft:${nftId}`,
      });
      return;
    }

    const collectionAddress = item.address || getNftOwnerAddress(item);
    const collectionId = buildNftCollectionId({
      address: collectionAddress,
      chain:
        (item.collection as Collection & Partial<CollectionList>).chain ||
        item.chain ||
        '',
      id: item.collection.id,
    });
    const existingCollection = collectionMap.get(collectionId);
    if (existingCollection) {
      existingCollection.nft_list.push({ ...item, collection: null });
      return;
    }

    const collection = createNftCollectionResourceValue(
      item,
      collectionAddress,
      [{ ...item, collection: null }],
    );
    collectionMap.set(collectionId, collection);
    collections.push({ collectionId, value: collection });
    candidates.push({
      row: { type: 'collection', collectionId },
      creditScore: Number(collection.credit_score) || 0,
      stableKey: `collection:${collectionId}`,
    });
  });

  collections.forEach(({ value }) => {
    value.nft_list.sort((a, b) =>
      buildNftEntityId(a).localeCompare(buildNftEntityId(b)),
    );
  });

  const previousPosition = new Map(
    (previousRows || []).map((row, index) => [
      getNftAssetsIndexRowKey(row),
      index,
    ]),
  );
  candidates.sort((a, b) => {
    const scoreDelta = b.creditScore - a.creditScore;
    if (scoreDelta) {
      return scoreDelta;
    }
    const aPosition = previousPosition.get(getNftAssetsIndexRowKey(a.row));
    const bPosition = previousPosition.get(getNftAssetsIndexRowKey(b.row));
    if (aPosition !== undefined || bPosition !== undefined) {
      return (
        (aPosition ?? Number.MAX_SAFE_INTEGER) -
        (bPosition ?? Number.MAX_SAFE_INTEGER)
      );
    }
    return a.stableKey.localeCompare(b.stableKey);
  });

  return { rows: candidates.map(candidate => candidate.row), collections };
};

export const buildNftAssetsIndexProjection = (
  nfts: CombinedNftItem[],
  _listKey: string,
  previousResult?: NftAssetsIndexResult,
): NftAssetsIndexProjection => {
  const projection = buildRows(nfts, previousResult?.rows);
  const rows = stabilizeRows(projection.rows, previousResult?.rows);
  const result = previousResult?.rows === rows ? previousResult : { rows };

  return {
    result,
    collections: projection.collections,
  };
};
