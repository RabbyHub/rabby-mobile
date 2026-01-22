import { CollectionList, NFTItem } from '@rabby-wallet/rabby-api/dist/types';
import { AbstractPortfolioToken, ActionItem } from '../types';
import { IProtocolItem } from '@/store/protocols';

const getSingleTokenTags = (type: string, item: AbstractPortfolioToken) => {
  return [
    `type: ${type}`,
    `addr: ${'address' in item ? item.address : ''}`,
    `owner_addr: ${'owner_addr' in item ? item.owner_addr : ''}`,
    `chain: ${item.chain}`,
    `tokenId: ${item._tokenId}`,
    `id: ${item.id}`,
  ];
};

const getSingleDefiTags = (type: string, item: IProtocolItem) => {
  return [
    `type: ${type}`,
    `id: ${item.id}`,
    `addr: ${item.owner_addr}`,
    `chain: ${item.chain}`,
  ];
};
const getSingleNftTags = (type: string, item: NFTItem) => {
  return [
    `type: ${type}`,
    `id: ${item.id}`,
    `addr: ${'address' in item ? item.address : ''}`,
    `inner_id: ${item.inner_id}`,
    `chain: ${item.chain}`,
    `price: ${item.usd_price}`,
    `amount: ${item.amount}`,
    `collection_id: ${item.collection_id}`,
  ];
};
const getCollectionTags = (type: string, item: CollectionList) => {
  return [
    `type: ${type}`,
    `id: ${item.id}`,
    `addr: ${'address' in item ? item.address : ''}`,
    `chain: ${item.chain}`,
    `name: ${item.name}`,
    `nft_length: ${item.nft_list.length}`,
    `nft_list: ${item.nft_list
      ?.map(nft => getSingleNftTags(type, nft))
      .join(',')}`,
  ];
};

export const getItemId = (item: ActionItem) => {
  if (!item.data || typeof item.data === 'string') {
    // header item
    return `render_header-${item.type}/${item.data}`;
  }
  if (item.type === 'unfold_token' || item.type === 'fold_token') {
    return getSingleTokenTags(item.type, item.data).join('/');
  }
  if (item.type === 'unfold_defi' || item.type === 'fold_defi') {
    const defi = item.data;
    return getSingleDefiTags(item.type, defi).join('/');
  }
  if (item.type === 'unfold_nft' || item.type === 'fold_nft') {
    if ('nft_list' in item.data) {
      return getCollectionTags(item.type, item.data).join('/');
    }
    return getSingleNftTags(item.type, item.data).join('/');
  }
  if (item.type === 'address_entry') {
    return `${item.type}/${item.data.address}/${item.data.type}/${
      item.data.brandName
      // @ts-expect-error FIXME: it seems error due to biz changes, fix it later
    }/${item.data.aliasName}/${item.data.balance}/${item.data.isLoss || ''}/${
      // @ts-expect-error FIXME: it seems error due to biz changes, fix it later
      item.data.changPercent || ''
    }`;
  }
  return `${item.type}/${JSON.stringify(item.data)}`;
};
