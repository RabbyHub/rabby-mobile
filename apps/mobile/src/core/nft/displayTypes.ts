import type {
  CollectionList,
  NFTItem,
} from '@rabby-wallet/rabby-api/dist/types';

export type DisplayNftItem = NFTItem & {
  _isFold?: boolean;
  _isManualFold?: boolean;
  is_core?: boolean;
};

export type CombineNFTItem = DisplayNftItem & {
  address?: string;
};

export type CombineCollectionList = CollectionList & {
  address?: string;
};

export type NftItemWithCollection = CombineNFTItem | CombineCollectionList;
