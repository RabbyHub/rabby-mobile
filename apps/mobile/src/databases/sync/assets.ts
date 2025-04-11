import { TokenItemEntity } from '../entities/tokenitem';
import { NFTItemEntity } from '../entities/nftItem';
import { prepareAppDataSource } from '../imports';
import { HistoryItemEntity } from '../entities/historyItem';
import {
  BuyHistoryList,
  Cex,
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
import { BuyItemEntity } from '../entities/buyItem';
import { CexEntity } from '../entities/cex';

export async function syncRemoteTokens(address: string, _tokens: TokenItem[]) {
  const data = [..._tokens];
  if (data.length === 0) {
    data.push(EMPTY_TOKEN_ITEM);
  }
  const tokens = data.sort((a, b) =>
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
    taskFor: 'token',
    batchSize: 300,
    concurrency: 1,
    delayBetweenTasks: 1.5 * 1e3,
  })
    .then(({ taskSignal, taskKey }) => {
      if (taskSignal.aborted) {
        console.warn(`[${taskKey}] Batch upsertion was aborted.`);
      } else {
        console.debug(`[${taskKey}] batch upsert tasks created`);
      }
    })
    .catch(error => {
      console.error('Batch upsert failed:', error);
    });
}

export async function syncRemoteHistory(
  address: string,
  history_list: TxAllHistoryResult['history_list'],
  setHistoryLoading,
) {
  try {
    console.debug('syncRemoteHistory history_list.length', history_list.length);

    const historyItems = history_list
      .filter(i => Boolean(i.tx))
      .map(raw => {
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
    await batchSaveWithPQueueAndTransaction(
      HistoryItemEntity,
      historyItems,
      {
        owner_addr: address,
        taskFor: 'all-history',
        batchSize: 200,
        concurrency: 1,
        delayBetweenTasks: 1.5 * 1e3,
        noNeedAbort: true,
      },
      setHistoryLoading,
    ).then(({ taskSignal, taskKey }) => {
      if (taskSignal.aborted) {
        console.warn(`[${taskKey}] Batch upsertion was aborted.`);
      } else {
        console.debug(`[${taskKey}] batch upsert tasks created`);
      }
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
      noNeedAbort: true,
    })
      .then(({ taskSignal, taskKey }) => {
        if (taskSignal.aborted) {
          console.warn(`[${taskKey}] Batch upsertion was aborted.`);
        } else {
          console.debug(`[${taskKey}] batch upsert tasks created`);
        }
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
  const data = [..._nfts];
  if (data.length === 0) {
    data.push(EMPTY_NFT_ITEM);
  }
  const nfts = data.sort((a, b) =>
    b.is_core === a.is_core ? 0 : b.is_core ? 1 : -1,
  );
  const nftItems = nfts.map(raw => {
    const nftItem = new NFTItemEntity();
    NFTItemEntity.fillEntity(nftItem, address, raw);

    return nftItem;
  });

  await prepareAppDataSource();
  // @TODO: remove this line, we don't need delete data first because we use upsert when save data
  await NFTItemEntity.deleteForAddress(address);
  await batchSaveWithPQueueAndTransaction(NFTItemEntity, nftItems, {
    owner_addr: address,
    taskFor: 'nfts',
    batchSize: 200,
    concurrency: 1,
    delayBetweenTasks: 1.5 * 1e3,
  })
    .then(({ taskSignal, taskKey }) => {
      if (taskSignal.aborted) {
        console.warn(`[${taskKey}] Batch upsertion was aborted.`);
      } else {
        console.debug(`[${taskKey}] batch upsert tasks created`);
      }
    })
    .catch(error => {
      console.error('Batch upsert failed:', error);
    });
}

export async function syncRemotePortocols(
  address: string,
  protocals: ComplexProtocol[],
) {
  const data = [...protocals];
  if (data.length === 0) {
    data.push(EMPTY_PROTOCOL_ITEM);
  }
  const items = data.map(raw => {
    const protocalItem = new PortocolItemEntity();
    PortocolItemEntity.fillEntity(protocalItem, address, raw);

    return protocalItem;
  });

  await prepareAppDataSource();
  // @TODO: remove this line, we don't need delete data first because we use upsert when save data
  await PortocolItemEntity.deleteForAddress(address);
  await batchSaveWithPQueueAndTransaction(PortocolItemEntity, items, {
    owner_addr: address,
    taskFor: 'protocols',
    batchSize: 200,
    concurrency: 1,
    delayBetweenTasks: 1.5 * 1e3,
  })
    .then(({ taskSignal, taskKey }) => {
      if (taskSignal.aborted) {
        console.warn(`[${taskKey}] Batch upsertion was aborted.`);
      } else {
        console.debug(`[${taskKey}] batch upsert tasks created`);
      }
    })
    .catch(error => {
      console.error('Batch upsert failed:', error);
    });
}

export async function syncRemoteBuyHistory(
  address: string,
  history_list: BuyHistoryList['histories'],
) {
  try {
    console.debug('syncRemoteBuyHistory length', history_list.length);

    const historyItems = history_list.map(raw => {
      const item = new BuyItemEntity();
      BuyItemEntity.fillEntity(item, address, raw);

      return item;
    });
    await prepareAppDataSource();

    console.debug('syncRemoteSwapHistory batchSaveWithPQueueAndTransaction');
    await batchSaveWithPQueueAndTransaction(BuyItemEntity, historyItems, {
      owner_addr: address,
      taskFor: 'buy-history',
      batchSize: 100,
      concurrency: 1,
      delayBetweenTasks: 1.5 * 1e3,
    })
      .then(({ taskSignal, taskKey }) => {
        if (taskSignal.aborted) {
          console.warn(`[${taskKey}] Batch upsertion was aborted.`);
        } else {
          console.debug(`[${taskKey}] batch upsert tasks created`);
        }
      })
      .catch(error => {
        console.error('Batch syncRemoteBuyHistory upsert failed:', error);
      });

    console.debug(
      'syncRemoteBuyHistory batchSaveWithPQueueAndTransaction done',
    );
    return {
      address,
      history_list: history_list,
    };
  } catch (e) {
    console.error('syncRemoteBuyHistory', e);
  }
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
      CexEntity.deleteForAddress(address),
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
  // @TODO: remove this line, we don't need delete data first because we use upsert when save data
  await BalanceEntity.deleteForAddress(address);
  await batchSaveWithPQueueAndTransaction(BalanceEntity, [balanceItem], {
    owner_addr: address,
    taskFor: 'balance',
    batchSize: 100,
    concurrency: 1,
  })
    .then(({ taskSignal, taskKey }) => {
      if (taskSignal.aborted) {
        console.warn(`[${taskKey}] Batch upsertion was aborted.`);
      } else {
        console.debug(`[${taskKey}] batch upsert tasks created`);
      }
    })
    .catch(error => {
      console.error('Batch upsert failed:', error);
    });
}

export async function syncCexInfo(address: string, cex?: Cex) {
  const cexItem = new CexEntity();
  CexEntity.fillEntity(
    cexItem,
    address,
    cex?.id || '',
    cex?.is_deposit || false,
    cex?.name || '',
    cex?.logo_url || '',
  );

  await prepareAppDataSource();
  await CexEntity.deleteForAddress(address);
  await batchSaveWithPQueueAndTransaction(CexEntity, [cexItem], {
    owner_addr: address,
    taskFor: 'cex',
    batchSize: 100,
    concurrency: 1,
  })
    .then(({ taskSignal, taskKey }) => {
      if (taskSignal.aborted) {
        console.warn(`[${taskKey}] Batch upsertion was aborted.`);
      } else {
        console.debug(`[${taskKey}] batch upsert tasks created`);
      }
    })
    .catch(error => {
      console.error('Batch upsert failed:', error);
    });
}
