import { openapi } from '@/core/request';
import { NFTItemEntity } from '@/databases/entities/nftItem';
import { syncRemoteNFTs } from '@/databases/sync/assets';
import { isValidCollection } from '@/utils/collections';
import type { Collection, NFTItem } from '@rabby-wallet/rabby-api/dist/types';

export type NftSnapshotLoadResult =
  | { status: 'snapshot'; nfts: NFTItem[]; remoteNfts?: NFTItem[] }
  | { status: 'unchanged' }
  | { status: 'superseded' };

export type NftSnapshotLoadOptions = {
  beforeRemote?: () => boolean;
  deferPersistence?: boolean;
};

export const batchQueryNFTSnapshotWithLocalCache = async (
  params: { id: string; isAll?: boolean; sortByCredit?: boolean },
  force?: boolean,
  onlySync?: boolean,
  options?: NftSnapshotLoadOptions,
): Promise<NftSnapshotLoadResult> => {
  const { id, isAll, sortByCredit } = params;
  if (isAll && sortByCredit) {
    const isExpired = await NFTItemEntity.isExpired(id);
    if (force || isExpired) {
      if (options?.beforeRemote && !options.beforeRemote()) {
        return { status: 'superseded' };
      }
      const nfts = await openapi.listNFT(id, isAll, sortByCredit);
      const collectionNfts = await openapi.collectionList({ id, isAll });
      const nftsWithCollection = nfts
        .map(nft => {
          const collection = collectionNfts.find(
            c => `${c.chain}:${c.id}` === nft.collection_id,
          );
          return {
            ...nft,
            collection: {
              ...(collection || {}),
              nft_list: [],
            } as unknown as Collection,
          };
        })
        .filter(n => {
          return isValidCollection(n.collection);
        });
      if (!options?.deferPersistence) {
        void syncRemoteNFTs(id, nftsWithCollection);
      }
      return {
        status: 'snapshot',
        nfts: nftsWithCollection,
        ...(options?.deferPersistence
          ? { remoteNfts: nftsWithCollection }
          : {}),
      };
    }
    if (onlySync) {
      return { status: 'unchanged' };
    }
    return {
      status: 'snapshot',
      nfts: await NFTItemEntity.batchQueryNFTs(id),
    };
  }
  return {
    status: 'snapshot',
    nfts: await openapi.listNFT(id, isAll, sortByCredit),
  };
};

export const batchQueryNFTsWithLocalCache = async (
  params: { id: string; isAll?: boolean; sortByCredit?: boolean },
  force?: boolean,
  onlySync?: boolean,
  options?: NftSnapshotLoadOptions,
): Promise<NFTItem[]> => {
  const result = await batchQueryNFTSnapshotWithLocalCache(
    params,
    force,
    onlySync,
    options,
  );
  return result.status === 'snapshot' ? result.nfts : [];
};
