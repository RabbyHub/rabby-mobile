import { TokenItemEntity } from '../entities/tokenitem';
import { NFTItemEntity } from '../entities/nftItem';
import { prepareAppDataSource } from '../imports';
import { HistoryItemEntity } from '../entities/historyItem';
import {
  ComplexProtocol,
  NFTItem,
  SwapTradeList,
  TokenItem,
  TotalBalanceResponse,
  TxAllHistoryResult,
} from '@rabby-wallet/rabby-api/dist/types';
import { PortocolItemEntity } from '../entities/portocolItem';
import {
  EMPTY_NFT_ITEM,
  EMPTY_PROTOCOL_ITEM,
  EMPTY_TOKEN_ITEM,
} from '@/constant/assets';
import { SwapItemEntity } from '../entities/swapitem';
import { BalanceEntity } from '../entities/balance';
import { batchSaveWithPQueueAndTransaction } from './_task';

export async function syncRemoteTokens(address: string, _tokens: TokenItem[]) {
  if (_tokens.length === 0) {
    _tokens.push(EMPTY_TOKEN_ITEM);
  }
  const tokens = _tokens.sort((a, b) =>
    b.is_core === a.is_core ? 0 : b.is_core ? 1 : -1,
  );

  const tokenItems = tokens.map(raw => {
    const tokenItem = new TokenItemEntity();
    TokenItemEntity.fillEntity(tokenItem, address, raw);

    return tokenItem;
  });

  await prepareAppDataSource();

  await TokenItemEntity.deleteForAddress(address);
  await batchSaveWithPQueueAndTransaction(TokenItemEntity, tokenItems, {
    owner_addr: address,
    taskFor: `token`,
    batchSize: 300,
    concurrency: 1,
    delayBetweenTasks: 1.5 * 1e3,
  })
    .then(() => {
      console.debug('batch upsert tasks created');
    })
    .catch(error => {
      console.error('Batch upsert failed:', error);
    });
}

export async function syncRemoteHistory(
  address: string,
  history_list: TxAllHistoryResult['history_list'],
) {
  try {
    console.debug('syncRemoteHistory history_list.length', history_list.length);

    const historyItems = history_list.map(raw => {
      const item = new HistoryItemEntity();
      HistoryItemEntity.fillEntity(item, address, raw);

      return item;
    });
    await prepareAppDataSource();
    // // leave here for debug save
    // const saveResult = await TokenItemEntity.save(tokenItems).catch(err => {
    //   console.error('TokenItemEntity.save err', err);
    //   throw err;
    // });
    console.debug('syncRemoteHistory batchSaveWithPQueueAndTransaction');
    await batchSaveWithPQueueAndTransaction(HistoryItemEntity, historyItems, {
      owner_addr: address,
      taskFor: 'all-history',
      batchSize: 500,
      concurrency: 1,
      delayBetweenTasks: 1.5 * 1e3,
    })
      .then(() => {
        console.debug('batch upsert tasks created');
      })
      .catch(error => {
        console.error('Batch upsert failed:', error);
      });

    console.debug('syncRemoteHistory batchSaveWithPQueueAndTransaction done');
    return {
      address,
      history_list: history_list,
    };
  } catch (e) {
    console.error('syncRemoteHistory', e);
  }
}

export async function syncRemoteSwapHistory(
  address: string,
  history_list: SwapTradeList['history_list'],
) {
  try {
    console.debug('syncRemoteSwapHistory length', history_list.length);

    const historyItems = history_list.map(raw => {
      const item = new SwapItemEntity();
      SwapItemEntity.fillEntity(item, address, raw);

      return item;
    });
    await prepareAppDataSource();
    // // leave here for debug save
    // const saveResult = await TokenItemEntity.save(tokenItems).catch(err => {
    //   console.error('TokenItemEntity.save err', err);
    //   throw err;
    // });
    console.debug('syncRemoteSwapHistory batchSaveWithPQueueAndTransaction');
    await batchSaveWithPQueueAndTransaction(SwapItemEntity, historyItems, {
      owner_addr: address,
      taskFor: 'swap-history',
      batchSize: 100,
      concurrency: 1,
      delayBetweenTasks: 1.5 * 1e3,
    })
      .then(() => {
        console.debug('batch upsert tasks created');
      })
      .catch(error => {
        console.error('Batch upsert failed:', error);
      });

    console.debug('syncSwapHistory batchSaveWithPQueueAndTransaction done');
    return {
      address,
      history_list: history_list,
    };
  } catch (e) {
    console.error('syncRemoteHistory', e);
  }
}

export async function syncRemoteNFTs(address: string, _nfts: NFTItem[]) {
  if (_nfts.length === 0) {
    _nfts.push(EMPTY_NFT_ITEM);
  }
  const nfts = _nfts.sort((a, b) =>
    b.is_core === a.is_core ? 0 : b.is_core ? 1 : -1,
  );
  const nftItems = nfts.map(raw => {
    const nftItem = new NFTItemEntity();
    NFTItemEntity.fillEntity(nftItem, address, raw);

    return nftItem;
  });

  await prepareAppDataSource();
  await NFTItemEntity.deleteForAddress(address);
  await batchSaveWithPQueueAndTransaction(NFTItemEntity, nftItems, {
    owner_addr: address,
    taskFor: 'nfts',
    batchSize: 200,
    concurrency: 1,
    delayBetweenTasks: 1.5 * 1e3,
  })
    .then(() => {
      console.debug('batch upsert tasks created');
    })
    .catch(error => {
      console.error('Batch upsert failed:', error);
    });
}

export async function syncRemotePortocols(
  address: string,
  protocals: ComplexProtocol[],
) {
  if (protocals.length === 0) {
    protocals.push(EMPTY_PROTOCOL_ITEM);
  }
  const items = protocals.map(raw => {
    const protocalItem = new PortocolItemEntity();
    PortocolItemEntity.fillEntity(protocalItem, address, raw);

    return protocalItem;
  });

  await prepareAppDataSource();
  await PortocolItemEntity.deleteForAddress(address);
  await batchSaveWithPQueueAndTransaction(PortocolItemEntity, items, {
    owner_addr: address,
    taskFor: `protocols`,
    batchSize: 200,
    concurrency: 1,
    delayBetweenTasks: 1.5 * 1e3,
  })
    .then(() => {
      console.debug('batch upsert tasks created');
    })
    .catch(error => {
      console.error('Batch upsert failed:', error);
    });
}

export const deleteDBResourceForAddress = async (_address: string) => {
  const address = _address.toLowerCase();
  try {
    await Promise.all([
      TokenItemEntity.deleteForAddress(address),
      NFTItemEntity.deleteForAddress(address),
      PortocolItemEntity.deleteForAddress(address),
      HistoryItemEntity.deleteForAddress(address),
      SwapItemEntity.deleteForAddress(address),
      BalanceEntity.deleteForAddress(address),
    ]);
  } catch (error) {
    console.log('deleteDBResourceForAddress', error);
  }
};

export const updateExpiredTime = async (_address: string, offest?: number) => {
  const address = _address.toLowerCase();
  try {
    await Promise.all([
      TokenItemEntity.willExpired(address, offest),
      NFTItemEntity.willExpired(address, offest),
      PortocolItemEntity.willExpired(address, offest),
    ]);
  } catch (error) {
    console.log('update expired)', error);
  }
};

export async function syncBalance(
  address: string,
  isCore: boolean,
  balance: TotalBalanceResponse,
) {
  const balanceItem = new BalanceEntity();
  BalanceEntity.fillEntity(balanceItem, address, isCore, balance);

  await prepareAppDataSource();
  await BalanceEntity.deleteForAddress(address);
  await batchSaveWithPQueueAndTransaction(BalanceEntity, [balanceItem], {
    owner_addr: address,
    taskFor: `balance`,
    batchSize: 100,
    concurrency: 1,
  })
    .then(() => {
      console.debug('batch upsert tasks created');
    })
    .catch(error => {
      console.error('Batch upsert failed:', error);
    });
}
