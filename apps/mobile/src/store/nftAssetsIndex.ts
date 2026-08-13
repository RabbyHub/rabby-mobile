import type { CollectionList } from '@rabby-wallet/rabby-api/dist/types';

import type { DisplayNftItem } from '@/types/assets';

export type CombinedNftItem = DisplayNftItem & { address?: string };

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

export type NftCollectionResourceValue = CollectionList & {
  address?: string;
};

export type NftAssetsIndexResult = {
  unFoldRows: NftAssetsIndexRow[];
  foldRows: NftAssetsIndexRow[];
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
  unFoldRows: EMPTY_NFT_ASSETS_INDEX_ROWS,
  foldRows: EMPTY_NFT_ASSETS_INDEX_ROWS,
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
  listKey: string,
  section: 'unfold' | 'fold',
  collection: NftCollectionResourceValue,
): NftCollectionId =>
  [
    listKey,
    section,
    collection.address?.toLowerCase() || '',
    collection.chain?.toLowerCase() || '',
    collection.id?.toLowerCase() || '',
  ].join('::') as NftCollectionId;

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
  section: 'unfold' | 'fold',
  listKey: string,
) => {
  const rows: NftAssetsIndexRow[] = [];
  const collections: NftAssetsIndexProjection['collections'] = [];
  const collectionMap = new Map<string, NftCollectionResourceValue>();

  nfts.forEach(item => {
    if (!item.collection_id || !item.collection) {
      rows.push({
        type: 'nft',
        nftId: buildNftEntityId(item),
      });
      return;
    }

    const collectionKey = `${getNftOwnerAddress(item)}-${item.chain}-${
      item.collection.id
    }`;
    const existingCollection = collectionMap.get(collectionKey);
    if (existingCollection) {
      existingCollection.nft_list.push({ ...item, collection: null });
      return;
    }

    const collection = {
      ...item.collection,
      address: item.address || getNftOwnerAddress(item),
      nft_list: [{ ...item, collection: null }],
    } as unknown as NftCollectionResourceValue;
    const collectionId = buildNftCollectionId(listKey, section, collection);
    collectionMap.set(collectionKey, collection);
    collections.push({ collectionId, value: collection });
    rows.push({ type: 'collection', collectionId });
  });

  return { rows, collections };
};

export const buildNftAssetsIndexProjection = (
  nfts: CombinedNftItem[],
  listKey: string,
  previousResult?: NftAssetsIndexResult,
): NftAssetsIndexProjection => {
  const foldNfts: CombinedNftItem[] = [];
  const unFoldNfts: CombinedNftItem[] = [];

  nfts.forEach(item => {
    if (item._isFold) {
      foldNfts.push(item);
    } else {
      unFoldNfts.push(item);
    }
  });

  const unFold = buildRows(unFoldNfts, 'unfold', listKey);
  const fold = buildRows(foldNfts, 'fold', listKey);
  const unFoldRows = stabilizeRows(unFold.rows, previousResult?.unFoldRows);
  const foldRows = stabilizeRows(fold.rows, previousResult?.foldRows);
  const result =
    previousResult &&
    previousResult.unFoldRows === unFoldRows &&
    previousResult.foldRows === foldRows
      ? previousResult
      : { unFoldRows, foldRows };

  return {
    result,
    collections: [...unFold.collections, ...fold.collections],
  };
};
