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
import { appOrmEvents } from './_event';
import { BuyItemEntity } from '../entities/buyItem';
import { CexEntity } from '../entities/cex';
import { deleteCurveCache } from '@/utils/24balanceCurveCache';
import { preferenceService, transactionHistoryService } from '@/core/services';
import { TransactionGroup } from '@/core/services/transactionHistory';
import { removeCexId } from '@/utils/addressCexId';
import type { EvmTotalBalanceResponse } from '../hooks/balance';
import { setHistoryLoading } from '@/hooks/historyTokenDict';
import type { ITokenItem } from '@/types/assets';
import { traceStartupDiagnostic } from '@/core/utils/startupDiagnostics';

export { patchSingleToken } from './token';

const BALANCE_SYNC_FLUSH_DELAY_MS = 32;
const BALANCE_BATCH_OWNER = '__balance_batch__';
const TOKEN_BATCH_OWNER = '__token_batch__';
const PROTOCOL_BATCH_OWNER = '__protocol_batch__';

type PendingBalanceSync = {
  owner_addr: string;
  item: BalanceEntity;
  resolve: () => void;
  reject: (error: unknown) => void;
};

const pendingBalanceSyncs: PendingBalanceSync[] = [];
let pendingBalanceFlushTimer: ReturnType<typeof setTimeout> | null = null;

function emitBalanceSyncResult(pending: PendingBalanceSync, success: boolean) {
  appOrmEvents.emit('onRemoteDataUpserted', {
    owner_addr: pending.owner_addr,
    taskFor: 'balance',
    syncDetails: {
      count: 1,
      total: 1,
      round: 0,
      batchSize: 1,
    },
    success,
  });
}

function scheduleBalanceSyncFlush() {
  if (pendingBalanceFlushTimer) {
    return;
  }

  pendingBalanceFlushTimer = setTimeout(() => {
    pendingBalanceFlushTimer = null;
    void flushPendingBalanceSyncs();
  }, BALANCE_SYNC_FLUSH_DELAY_MS);
}

async function flushPendingBalanceSyncs() {
  const pending = pendingBalanceSyncs.splice(0);
  if (!pending.length) {
    return;
  }

  try {
    await prepareAppDataSourceWithDiag('balance', BalanceEntity.name);
    await batchSaveWithPQueueAndTransaction(
      BalanceEntity,
      pending.map(item => item.item),
      {
        owner_addr: BALANCE_BATCH_OWNER,
        taskFor: 'balance',
        batchSize: 100,
        concurrency: 1,
        delayBetweenTasks: 0,
        waitTaskDoneReturn: true,
        noNeedAbort: true,
        skipEmit: true,
      },
    );

    pending.forEach(item => {
      emitBalanceSyncResult(item, true);
      item.resolve();
    });
  } catch (error) {
    pending.forEach(item => {
      emitBalanceSyncResult(item, false);
      item.reject(error);
    });
  }
}

function enqueueBalanceSync(owner_addr: string, item: BalanceEntity) {
  return new Promise<void>((resolve, reject) => {
    pendingBalanceSyncs.push({
      owner_addr,
      item,
      resolve,
      reject,
    });
    scheduleBalanceSyncFlush();
  });
}

function traceEntityBuild(
  taskFor: string,
  entityName: string,
  startedAt: number,
  rawCount: number,
  entityCount: number,
) {
  traceStartupDiagnostic('db', 'entity_build', {
    taskFor,
    entityName,
    rawCount,
    entityCount,
    durationMs: Date.now() - startedAt,
  });
}

async function prepareAppDataSourceWithDiag(
  taskFor: string,
  entityName: string,
) {
  const startedAt = Date.now();
  await prepareAppDataSource();
  traceStartupDiagnostic('db', 'prepare_data_source', {
    taskFor,
    entityName,
    durationMs: Date.now() - startedAt,
  });
}

function normalizeTokenInput(_tokens: TokenItem[] | ITokenItem[]) {
  const data = [..._tokens];
  if (data.length === 0) {
    data.push(EMPTY_TOKEN_ITEM);
  }

  return data.sort((a, b) =>
    b.is_core === a.is_core ? 0 : b.is_core ? 1 : -1,
  );
}

function buildTokenEntities(
  address: string,
  _tokens: TokenItem[] | ITokenItem[],
  syncTimestamp: number,
) {
  const tokens = normalizeTokenInput(_tokens);
  const tokenItems = tokens.map(raw => {
    const tokenItem = new TokenItemEntity();
    TokenItemEntity.fillEntity(tokenItem, address, raw);
    tokenItem._local_updated_at = syncTimestamp;

    return tokenItem;
  });

  return {
    tokens,
    tokenItems,
  };
}

function emitTokenSyncResult(
  owner_addr: string,
  count: number,
  success: boolean,
) {
  appOrmEvents.emit('onRemoteDataUpserted', {
    owner_addr,
    taskFor: 'token',
    syncDetails: {
      count,
      total: count,
      round: 0,
      batchSize: count,
    },
    success,
  });
}

function normalizeProtocolInput(protocols: ComplexProtocol[]) {
  const data = [...protocols];
  if (data.length === 0) {
    data.push(EMPTY_PROTOCOL_ITEM);
  }

  return data;
}

function buildProtocolEntities(
  address: string,
  protocols: ComplexProtocol[],
  syncTimestamp: number,
) {
  const data = normalizeProtocolInput(protocols);
  const items = data.map(raw => {
    const protocolItem = new ProtocolItemEntity();
    ProtocolItemEntity.fillEntity(protocolItem, address, raw);
    protocolItem._local_updated_at = syncTimestamp;

    return protocolItem;
  });

  return {
    protocols: data,
    items,
  };
}

function emitProtocolSyncResult(
  owner_addr: string,
  count: number,
  success: boolean,
) {
  appOrmEvents.emit('onRemoteDataUpserted', {
    owner_addr,
    taskFor: 'protocols',
    syncDetails: {
      count,
      total: count,
      round: 0,
      batchSize: count,
    },
    success,
  });
}

export async function syncRemoteTokens(
  address: string,
  _tokens: TokenItem[] | ITokenItem[],
) {
  const syncTimestamp = Date.now();

  const entityBuildStartedAt = Date.now();
  const { tokens, tokenItems } = buildTokenEntities(
    address,
    _tokens,
    syncTimestamp,
  );
  traceEntityBuild(
    'token',
    TokenItemEntity.name,
    entityBuildStartedAt,
    tokens.length,
    tokenItems.length,
  );

  await prepareAppDataSourceWithDiag('token', TokenItemEntity.name);

  // await TokenItemEntity.deleteForAddress(address);
  await batchSaveWithPQueueAndTransaction(TokenItemEntity, tokenItems, {
    owner_addr: address,
    taskFor: 'token',
    batchSize: 300,
    concurrency: 1,
    delayBetweenTasks: 1.5 * 1e3,
    waitTaskDoneReturn: true,
    afterBatches: async () => {
      await TokenItemEntity.cleanupStaleTokens(address, syncTimestamp);
    },
  })
    .then(({ taskSignal, taskKey, queueCompleted }) => {
      if (queueCompleted) {
        console.debug(`[${taskKey}] batch upsert tasks completed`);
      } else {
        console.warn(`[${taskKey}] batch upsert tasks aborted.`);
      }
    })
    .catch(error => {
      console.error('Batch upsert failed:', error);
    });
}

export async function syncRemoteTokensForAddresses(
  tokenMap: Record<string, TokenItem[] | ITokenItem[]>,
) {
  const addresses = Object.keys(tokenMap).map(address => address.toLowerCase());
  if (!addresses.length) {
    return;
  }

  const syncTimestamp = Date.now();
  const entityBuildStartedAt = Date.now();
  const tokenItemsByAddress = new Map<string, TokenItemEntity[]>();
  const allTokenItems: TokenItemEntity[] = [];
  let rawCount = 0;

  addresses.forEach(address => {
    const { tokens, tokenItems } = buildTokenEntities(
      address,
      tokenMap[address] || [],
      syncTimestamp,
    );
    rawCount += tokens.length;
    tokenItemsByAddress.set(address, tokenItems);
    allTokenItems.push(...tokenItems);
  });

  traceEntityBuild(
    'token',
    TokenItemEntity.name,
    entityBuildStartedAt,
    rawCount,
    allTokenItems.length,
  );

  await prepareAppDataSourceWithDiag('token', TokenItemEntity.name);
  await batchSaveWithPQueueAndTransaction(TokenItemEntity, allTokenItems, {
    owner_addr: `${TOKEN_BATCH_OWNER}:${addresses.length}`,
    taskFor: 'token',
    batchSize: 300,
    concurrency: 1,
    delayBetweenTasks: 0,
    waitTaskDoneReturn: true,
    noNeedAbort: true,
    skipEmit: true,
    afterBatches: async () => {
      await Promise.all(
        addresses.map(address =>
          TokenItemEntity.cleanupStaleTokens(address, syncTimestamp),
        ),
      );
    },
  })
    .then(({ queueCompleted, taskKey }) => {
      if (!queueCompleted) {
        console.warn(`[${taskKey}] batch upsert tasks aborted.`);
        addresses.forEach(address => {
          emitTokenSyncResult(
            address,
            tokenItemsByAddress.get(address)?.length || 0,
            false,
          );
        });
        return;
      }

      addresses.forEach(address => {
        emitTokenSyncResult(
          address,
          tokenItemsByAddress.get(address)?.length || 0,
          true,
        );
      });
      console.debug(`[${taskKey}] multi-address batch upsert tasks completed`);
    })
    .catch(error => {
      addresses.forEach(address => {
        emitTokenSyncResult(
          address,
          tokenItemsByAddress.get(address)?.length || 0,
          false,
        );
      });
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

  const entityBuildStartedAt = Date.now();
  const tokenItems = updateTokens.map(raw => {
    const tokenItem = new TokenItemEntity();
    TokenItemEntity.fillEntity(tokenItem, raw.address, raw.token);
    tokenItem._local_updated_at = syncTimestamp;
    return tokenItem;
  });
  traceEntityBuild(
    'token',
    TokenItemEntity.name,
    entityBuildStartedAt,
    updateTokens.length,
    tokenItems.length,
  );

  await prepareAppDataSourceWithDiag('token', TokenItemEntity.name);

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
      a => a.maxGasTx && historyItem.txHash === a.maxGasTx.hash,
    );

    if (localSwapFailTransaction?.maxGasTx) {
      const { maxGasTx } = localSwapFailTransaction;
      const swapAction =
        maxGasTx.action?.actionData.swap ||
        maxGasTx.action?.actionData.wrapToken ||
        maxGasTx.action?.actionData.unWrapToken;

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
    const entityBuildStartedAt = Date.now();
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
    traceEntityBuild(
      'all-history',
      HistoryItemEntity.name,
      entityBuildStartedAt,
      history_list.length,
      historyItems.length,
    );
    await prepareAppDataSourceWithDiag('all-history', HistoryItemEntity.name);
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
  const entityBuildStartedAt = Date.now();
  const nftItems = nfts.map(raw => {
    const nftItem = new NFTItemEntity();
    NFTItemEntity.fillEntity(nftItem, address, raw);
    nftItem._local_updated_at = syncTimestamp;
    return nftItem;
  });
  traceEntityBuild(
    'nfts',
    NFTItemEntity.name,
    entityBuildStartedAt,
    nfts.length,
    nftItems.length,
  );

  await prepareAppDataSourceWithDiag('nfts', NFTItemEntity.name);
  await batchSaveWithPQueueAndTransaction(NFTItemEntity, nftItems, {
    owner_addr: address,
    taskFor: 'nfts',
    batchSize: 200,
    concurrency: 1,
    delayBetweenTasks: 1.5 * 1e3,
    waitTaskDoneReturn: true,
    afterBatches: async () => {
      await NFTItemEntity.cleanupStaleNFTs(address, syncTimestamp);
    },
  })
    .then(({ taskSignal, taskKey, queueCompleted }) => {
      if (queueCompleted) {
        console.debug(`[${taskKey}] batch upsert tasks completed`);
      } else {
        console.warn(`[${taskKey}] batch upsert tasks aborted.`);
      }
    })
    .catch(error => {
      console.error('Batch upsert failed:', error);
    });
}

export async function syncRemoteProtocols(
  address: string,
  protocols: ComplexProtocol[],
) {
  const syncTimestamp = Date.now();
  const entityBuildStartedAt = Date.now();
  const { protocols: data, items } = buildProtocolEntities(
    address,
    protocols,
    syncTimestamp,
  );
  traceEntityBuild(
    'protocols',
    ProtocolItemEntity.name,
    entityBuildStartedAt,
    data.length,
    items.length,
  );

  await prepareAppDataSourceWithDiag('protocols', ProtocolItemEntity.name);
  await batchSaveWithPQueueAndTransaction(ProtocolItemEntity, items, {
    owner_addr: address,
    taskFor: 'protocols',
    batchSize: 200,
    concurrency: 1,
    delayBetweenTasks: 1.5 * 1e3,
    waitTaskDoneReturn: true,
    afterBatches: async () => {
      await ProtocolItemEntity.cleanupStaleProtocols(address, syncTimestamp);
    },
  })
    .then(({ taskSignal, taskKey, queueCompleted }) => {
      if (queueCompleted) {
        console.debug(`[${taskKey}] batch upsert tasks completed`);
      } else {
        console.warn(`[${taskKey}] batch upsert tasks aborted.`);
      }
    })
    .catch(error => {
      console.error('Batch upsert failed:', error);
    });
}

export async function syncRemoteProtocolsForAddresses(
  protocolMap: Record<string, ComplexProtocol[]>,
) {
  const addresses = Object.keys(protocolMap).map(address =>
    address.toLowerCase(),
  );
  if (!addresses.length) {
    return;
  }

  const syncTimestamp = Date.now();
  const entityBuildStartedAt = Date.now();
  const protocolItemsByAddress = new Map<string, ProtocolItemEntity[]>();
  const allProtocolItems: ProtocolItemEntity[] = [];
  let rawCount = 0;

  addresses.forEach(address => {
    const { protocols, items } = buildProtocolEntities(
      address,
      protocolMap[address] || [],
      syncTimestamp,
    );
    rawCount += protocols.length;
    protocolItemsByAddress.set(address, items);
    allProtocolItems.push(...items);
  });

  traceEntityBuild(
    'protocols',
    ProtocolItemEntity.name,
    entityBuildStartedAt,
    rawCount,
    allProtocolItems.length,
  );

  await prepareAppDataSourceWithDiag('protocols', ProtocolItemEntity.name);
  await batchSaveWithPQueueAndTransaction(
    ProtocolItemEntity,
    allProtocolItems,
    {
      owner_addr: `${PROTOCOL_BATCH_OWNER}:${addresses.length}`,
      taskFor: 'protocols',
      batchSize: 200,
      concurrency: 1,
      delayBetweenTasks: 0,
      waitTaskDoneReturn: true,
      noNeedAbort: true,
      skipEmit: true,
      afterBatches: async () => {
        await Promise.all(
          addresses.map(address =>
            ProtocolItemEntity.cleanupStaleProtocols(address, syncTimestamp),
          ),
        );
      },
    },
  )
    .then(({ queueCompleted, taskKey }) => {
      if (!queueCompleted) {
        console.warn(`[${taskKey}] batch upsert tasks aborted.`);
        addresses.forEach(address => {
          emitProtocolSyncResult(
            address,
            protocolItemsByAddress.get(address)?.length || 0,
            false,
          );
        });
        return;
      }

      addresses.forEach(address => {
        emitProtocolSyncResult(
          address,
          protocolItemsByAddress.get(address)?.length || 0,
          true,
        );
      });
      console.debug(`[${taskKey}] multi-address batch upsert tasks completed`);
    })
    .catch(error => {
      addresses.forEach(address => {
        emitProtocolSyncResult(
          address,
          protocolItemsByAddress.get(address)?.length || 0,
          false,
        );
      });
      console.error('Batch upsert failed:', error);
    });
}

export async function syncRemoteProtocol(
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

export async function syncBalance(
  address: string,
  isCore: boolean,
  balance: EvmTotalBalanceResponse,
) {
  const entityBuildStartedAt = Date.now();
  const balanceItem = new BalanceEntity();
  BalanceEntity.fillEntity(balanceItem, address.toLowerCase(), isCore, balance);
  traceEntityBuild('balance', BalanceEntity.name, entityBuildStartedAt, 1, 1);

  await enqueueBalanceSync(address, balanceItem)
    .then(() => {
      console.debug(`[balance-${address}] batch upsert tasks created`);
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
