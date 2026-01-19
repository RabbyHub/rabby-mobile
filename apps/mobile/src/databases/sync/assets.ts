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
  TxAllHistoryResult,
  TxHistoryResult,
} from '@rabby-wallet/rabby-api/dist/types';
import { ProtocolItemEntity } from '../entities/portocolItem';
import {
  EMPTY_NFT_ITEM,
  EMPTY_PROTOCOL_ITEM,
  EMPTY_TOKEN_ITEM,
} from '@/constant/assets';
import { BalanceEntity } from '../entities/balance';
import { batchSaveWithPQueueAndTransaction, BeforeEmitFn } from './_task';
import { BuyItemEntity } from '../entities/buyItem';
import { CexEntity } from '../entities/cex';
import { deleteCurveCache } from '@/utils/24balanceCurveCache';
import { preferenceService, transactionHistoryService } from '@/core/services';
import { TransactionGroup } from '@/core/services/transactionHistory';
import { removeCexId } from '@/utils/addressCexId';
import { EvmTotalBalanceResponse } from '../hooks/balance';
import { setHistoryLoading } from '@/hooks/historyTokenDict';
import { ITokenItem } from '@/store/tokens';

export async function syncRemoteTokens(
  address: string,
  _tokens: TokenItem[] | ITokenItem[],
) {
  const data = [..._tokens];
  if (data.length === 0) {
    data.push(EMPTY_TOKEN_ITEM);
  }
  const tokens = data.sort((a, b) =>
    b.is_core === a.is_core ? 0 : b.is_core ? 1 : -1,
  );

  const syncTimestamp = Date.now();

  const tokenItems = tokens.map(raw => {
    const tokenItem = new TokenItemEntity();
    TokenItemEntity.fillEntity(tokenItem, address, raw);
    tokenItem._local_updated_at = syncTimestamp;

    return tokenItem;
  });

  await prepareAppDataSource();

  // await TokenItemEntity.deleteForAddress(address);
  await batchSaveWithPQueueAndTransaction(TokenItemEntity, tokenItems, {
    owner_addr: address,
    taskFor: 'token',
    batchSize: 300,
    concurrency: 1,
    delayBetweenTasks: 1.5 * 1e3,
    waitTaskDoneReturn: true,
  })
    .then(({ taskSignal, taskKey, queueCompleted }) => {
      if (queueCompleted) {
        console.debug(`[${taskKey}] batch upsert tasks completed`);
        TokenItemEntity.cleanupStaleTokens(address, syncTimestamp);
      } else {
        console.warn(`[${taskKey}] batch upsert tasks aborted.`);
      }
    })
    .catch(error => {
      console.error('Batch upsert failed:', error);
    });
}

export async function syncRemoteTokensAmount(
  updateTokens: {
    address: string;
    token: TokenItem;
  }[],
) {
  const syncTimestamp = Date.now();

  const tokenItems = updateTokens.map(raw => {
    const tokenItem = new TokenItemEntity();
    TokenItemEntity.fillEntity(tokenItem, raw.address, raw.token);
    tokenItem._local_updated_at = syncTimestamp;
    return tokenItem;
  });

  await prepareAppDataSource();

  await batchSaveWithPQueueAndTransaction(TokenItemEntity, tokenItems, {
    owner_addr: '',
    taskFor: 'token',
    batchSize: 20, // most time is updating a few tokens only
    concurrency: 1,
    delayBetweenTasks: 1.5 * 1e3,
    waitTaskDoneReturn: true,
  });
}

const updateSwapFailHistoryItem = (
  historyItem: HistoryItemEntity,
  swapFailHistoryList: TransactionGroup[],
) => {
  if (historyItem.status === 0) {
    const localSwapFailTransaction = swapFailHistoryList.find(
      a => historyItem.txHash === a.maxGasTx.hash,
    );

    if (localSwapFailTransaction) {
      const swapAction =
        localSwapFailTransaction.maxGasTx.action?.actionData.swap ||
        localSwapFailTransaction.maxGasTx.action?.actionData.wrapToken ||
        localSwapFailTransaction.maxGasTx.action?.actionData.unWrapToken;

      if (swapAction) {
        const sends = [
          {
            token_id: swapAction.payToken.id,
            to_addr: '',
            amount: swapAction.payToken.amount,
            token: swapAction.payToken,
          },
        ];
        const receives = [
          {
            token_id: swapAction.receiveToken.id,
            from_addr: swapAction.receiver,
            amount:
              swapAction.receiveToken.amount ||
              swapAction.receiveToken.min_amount,
            token: swapAction.receiveToken,
          },
        ];
        historyItem.sends = sends;
        historyItem.receives = receives;
      }
    }
  }
};
export async function syncRemoteHistory(
  address: string,
  res: TxAllHistoryResult | TxHistoryResult,
) {
  try {
    console.debug(
      'syncRemoteHistory history_list.length',
      res.history_list.length,
    );

    const { history_list, project_dict } = res;
    const tokenDict =
      (res as TxAllHistoryResult).token_uuid_dict ||
      (res as TxHistoryResult).token_dict;

    const projectDict = project_dict;

    const pinedQueue = preferenceService.getPinToken();
    const customTxItemsMap = transactionHistoryService.getCustomTxItemMap();
    const swapFailHistoryList =
      transactionHistoryService.getSwapFailTransactions(address);
    const historyItems = history_list
      .filter(i => Boolean(i.tx))
      .map(raw => {
        const customKey = `${address.toLowerCase()}-${raw.chain}-${raw.id}`;
        const item = new HistoryItemEntity();
        HistoryItemEntity.fillEntity(
          item,
          address,
          raw,
          tokenDict,
          projectDict,
          pinedQueue,
          customTxItemsMap[customKey] || undefined,
        );
        updateSwapFailHistoryItem(item, swapFailHistoryList);
        return item;
      });
    await prepareAppDataSource();
    // // leave here for debug save
    // const saveResult = await TokenItemEntity.save(tokenItems).catch(err => {
    //   console.error('TokenItemEntity.save err', err);
    //   throw err;
    // });
    await batchSaveWithPQueueAndTransaction(HistoryItemEntity, historyItems, {
      owner_addr: address,
      taskFor: 'all-history',
      batchSize: 200,
      concurrency: 1,
      delayBetweenTasks: 1.5 * 1e3,
      noNeedAbort: true,
      beforeEmit: ctx => {
        if (ctx.taskFor === 'all-history') {
          setTimeout(() => {
            setHistoryLoading?.(prev => ({
              ...prev,
              [ctx.owner_addr]: false,
            }));
          }, 2000);
        }
      },
    }).then(({ taskSignal, taskKey }) => {
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

export async function syncRemoteNFTs(address: string, _nfts: NFTItem[]) {
  const data = [..._nfts];
  if (data.length === 0) {
    data.push(EMPTY_NFT_ITEM);
  }
  const nfts = data.sort((a, b) =>
    b.is_core === a.is_core ? 0 : b.is_core ? 1 : -1,
  );
  const syncTimestamp = Date.now();
  const nftItems = nfts.map(raw => {
    const nftItem = new NFTItemEntity();
    NFTItemEntity.fillEntity(nftItem, address, raw);
    nftItem._local_updated_at = syncTimestamp;
    return nftItem;
  });

  await prepareAppDataSource();
  await batchSaveWithPQueueAndTransaction(NFTItemEntity, nftItems, {
    owner_addr: address,
    taskFor: 'nfts',
    batchSize: 200,
    concurrency: 1,
    delayBetweenTasks: 1.5 * 1e3,
    waitTaskDoneReturn: true,
  })
    .then(({ taskSignal, taskKey, queueCompleted }) => {
      if (queueCompleted) {
        console.debug(`[${taskKey}] batch upsert tasks completed`);
        NFTItemEntity.cleanupStaleNFTs(address, syncTimestamp);
      } else {
        console.warn(`[${taskKey}] batch upsert tasks aborted.`);
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
  const syncTimestamp = Date.now();
  const items = data.map(raw => {
    const protocalItem = new ProtocolItemEntity();
    ProtocolItemEntity.fillEntity(protocalItem, address, raw);
    protocalItem._local_updated_at = syncTimestamp;

    return protocalItem;
  });

  await prepareAppDataSource();
  await batchSaveWithPQueueAndTransaction(ProtocolItemEntity, items, {
    owner_addr: address,
    taskFor: 'protocols',
    batchSize: 200,
    concurrency: 1,
    delayBetweenTasks: 1.5 * 1e3,
    waitTaskDoneReturn: true,
  })
    .then(({ taskSignal, taskKey, queueCompleted }) => {
      if (queueCompleted) {
        console.debug(`[${taskKey}] batch upsert tasks completed`);
        ProtocolItemEntity.cleanupStaleProtocols(address, syncTimestamp);
      } else {
        console.warn(`[${taskKey}] batch upsert tasks aborted.`);
      }
    })
    .catch(error => {
      console.error('Batch upsert failed:', error);
    });
}

export async function syncRemotePortocol(
  address: string,
  protocol: ComplexProtocol | null | undefined,
  opts?: { deleteId?: string },
) {
  const repo = ProtocolItemEntity.getRepository();

  if (protocol) {
    const syncTimestamp = Date.now();
    const protocolItem = new ProtocolItemEntity();
    ProtocolItemEntity.fillEntity(protocolItem, address, protocol);
    protocolItem._local_updated_at = syncTimestamp;

    await prepareAppDataSource();
    await batchSaveWithPQueueAndTransaction(
      ProtocolItemEntity,
      [protocolItem],
      {
        owner_addr: address,
        taskFor: 'protocols',
        batchSize: 200,
        concurrency: 1,
        delayBetweenTasks: 1.5 * 1e3,
        waitTaskDoneReturn: true,
      },
    ).catch(error => {
      console.error('Batch upsert failed:', error);
    });
    return;
  }

  const deleteId = opts?.deleteId;
  if (deleteId) {
    await repo.delete({ owner_addr: address, id: deleteId });
  }
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
      ProtocolItemEntity.deleteForAddress(address),
      HistoryItemEntity.deleteForAddress(address),
      BalanceEntity.deleteForAddress(address),
      CexEntity.deleteForAddress(address),
      deleteCurveCache(address),
      removeCexId(address),
    ]);
  } catch (error) {
    console.log('deleteDBResourceForAddress', error);
  }
};

export async function patchSingleToken(address: string, token: TokenItem) {
  const tokenItem = new TokenItemEntity();
  TokenItemEntity.fillEntity(tokenItem, address, token);
  await prepareAppDataSource();
  await batchSaveWithPQueueAndTransaction(TokenItemEntity, [tokenItem], {
    owner_addr: address,
    taskFor: 'token',
    batchSize: 100,
    concurrency: 1,
    noNeedAbort: true,
  })
    .then(({ taskSignal, taskKey }) => {
      if (taskSignal.aborted) {
        console.warn(`[${taskKey}] patchSingleToken upsertion was aborted.`);
      } else {
        console.debug(`[${taskKey}] patchSingleToken upsert tasks created`);
      }
    })
    .catch(error => {
      console.error('Batch upsert patchSingleToken failed:', error);
    });
}

export async function syncBalance(
  address: string,
  isCore: boolean,
  balance: EvmTotalBalanceResponse,
) {
  const balanceItem = new BalanceEntity();
  BalanceEntity.fillEntity(balanceItem, address, isCore, balance);

  await prepareAppDataSource();
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
  // await CexEntity.deleteForAddress(address);
  await batchSaveWithPQueueAndTransaction(CexEntity, [cexItem], {
    owner_addr: address,
    taskFor: 'cex',
    batchSize: 100,
    concurrency: 1,
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
}
