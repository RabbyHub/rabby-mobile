import { openapi } from '@/core/request';
import { NFTItemEntity } from '@/databases/entities/nftItem';
import { syncRemoteNFTs } from '@/databases/sync/assets';
import { Collection, NFTItem } from '@rabby-wallet/rabby-api/dist/types';
import { runOnJS } from 'react-native-reanimated';

export const batchQueryNFTsWithLocalCache = async (
  params: { id: string; isAll?: boolean; sortByCredit?: boolean },
  force?: boolean,
  onlySync?: boolean,
): Promise<NFTItem[]> => {
  const { id, isAll, sortByCredit } = params;
  if (isAll && sortByCredit) {
    const isExpired = await NFTItemEntity.isExpired(id);
    if (force || isExpired) {
      const nfts = await openapi.listNFT(id, isAll, sortByCredit);
      const collectionNfts = await openapi.collectionList({ id, isAll });
      const nftsWithCollection = nfts.map(nft => {
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
      });
      syncRemoteNFTs(id, [...nftsWithCollection]);
      return nftsWithCollection;
    } else {
      return onlySync ? [] : NFTItemEntity.batchQueryNFTs(id);
    }
  }
  return openapi.listNFT(id, isAll, sortByCredit);
};
