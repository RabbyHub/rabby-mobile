import { CollectionList, NFTItem } from '@rabby-wallet/rabby-api/dist/types';
import { AbstractPortfolioToken, ActionItem } from '../types';
import { DisplayedProject } from './project';

const getSingleTokenTags = (type: string, item: AbstractPortfolioToken) => {
  return [
    `type: ${type}`,
    `chain: ${item.chain}`,
    `symbol: ${item.symbol}`,
    `tokenId: ${item._tokenId}`,
    `id: ${item.id}`,
    `price_24h_change: ${item.price_24h_change}`,
    `price: ${item.price}`,
    `time_at: ${item.time_at}`,

    item?._isPined ? 'pin' : 'unpin',
    item?._isFold ? 'fold' : 'unfold',
    item?._isExcludeBalance ? 'exclude' : 'include',
    item?._isManualFold ? 'manual_fold' : 'auto_fold',
  ];
};

const getSingleDefiTags = (type: string, item: DisplayedProject) => {
  return [
    `type: ${type}`,
    `id: ${item.id}`,
    `chain: ${item.chain}`,
    `price_24h_change: ${item.netWorthChange}`,
    `price: ${item.netWorth}`,
    item?._isFold ? 'fold' : 'unfold',
    item?._isExcludeBalance ? 'exclude' : 'include',
    item?._isManualFold ? 'manual_fold' : 'auto_fold',
  ];
};
const getSingleNftTags = (type: string, item: NFTItem) => {
  return [
    `type: ${type}`,
    `id: ${item.id}`,
    `inner_id: ${item.inner_id}`,
    `chain: ${item.chain}`,
    `price: ${item.usd_price}`,
    `amount: ${item.amount}`,
    `collection_id: ${item.collection_id}`,
    item?._isFold ? 'fold' : 'unfold',
    item?._isManualFold ? 'manual_fold' : 'auto_fold',
  ];
};
const getCollectionTags = (type: string, item: CollectionList) => {
  return [
    `type: ${type}`,
    `id: ${item.id}`,
    `chain: ${item.chain}`,
    `name: ${item.name}`,
    `nft_length: ${item.nft_list.length}`,
    `nft_list: ${item.nft_list
      ?.map(nft => getSingleNftTags(type, nft))
      .join(',')}`,
    item?._isFold ? 'fold' : 'unfold',
    item?._isManualFold ? 'manual_fold' : 'auto_fold',
  ];
};

export const getItemId = (item: ActionItem) => {
  if (!item.data || typeof item.data === 'string') {
    // header item
    return `${item.type}/${item.data}`;
  }
  if (item.type === 'unfold_token' || item.type === 'fold_token') {
    return getSingleTokenTags(item.type, item.data).join('/');
  }
  if (item.type === 'unfold_defi' || item.type === 'fold_defi') {
    const defis = item.data as DisplayedProject[];
    return defis
      .map(defi => getSingleDefiTags(item.type, defi).join('/'))
      .join('/');
  }
  if (item.type === 'unfold_nft' || item.type === 'fold_nft') {
    if ('nft_list' in item.data) {
      return getCollectionTags(item.type, item.data).join('/');
    }
    return getSingleNftTags(item.type, item.data).join('/');
  }
};
