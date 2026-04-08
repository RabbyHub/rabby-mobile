import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useMemoizedFn } from 'ahooks';
import {
  AssetCtx,
  AssetPosition,
  ClearinghouseState,
  MarginSummary,
  OpenOrder,
  UserAbstractionResp,
  UserNonFundingLedgerUpdates,
  WsFill,
} from '@rabby-wallet/hyperliquid-sdk';
// import { ApproveSignatures } from '@/background/service/perps';
import { Account } from '@/core/services/preference';
import { ApproveSignatures } from '@/core/services/perpsService';
import { DEFAULT_TOP_ASSET, HYPE_EVM_BRIDGE_ADDRESS } from '@/constant/perps';
import { apisPerps } from '@/core/apis';
import {
  formatAllDexsClearinghouseState,
  formatMarkData,
  formatPositionPnl,
  formatSpotState,
} from '@/utils/perps';
import { eventBus, EVENTS } from '@/utils/events';
import { openapi } from '@/core/request';
import { unionBy } from 'lodash';
import { zCreate } from '@/core/utils/reexports';
import {
  resolveValFromUpdater,
  runIIFEFunc,
  UpdaterOrPartials,
} from '@/core/utils/store';
import { AppState } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { perpsService } from '@/core/services';
import { PerpTopToken } from '@rabby-wallet/rabby-api/dist/types';
import { stats } from '@/utils/stats';
import BigNumber from 'bignumber.js';

let perpsTopTokenCache: PerpTopToken[] = [];

// 保持原有的接口定义
export interface PositionAndOpenOrder extends AssetPosition {
  openOrders: OpenOrder[];
}

export interface AccountSummary extends MarginSummary {
  withdrawable: string;
}

export interface MarketData {
  index: number;
  logoUrl: string;
  name: string;
  maxLeverage: number;
  minLeverage: number;
  maxUsdValueSize: string;
  szDecimals: number;
  pxDecimals: number;
  onlyIsolated?: boolean;
  dayBaseVlm: string;
  dayNtlVlm: string;
  funding: string;
  markPx: string;
  midPx: string;
  openInterest: string;
  oraclePx: string;
  premium: string;
  prevDayPx: string;
  dexId: string;
}

export type MarketDataMap = Record<string, MarketData>;

export interface AccountHistoryItem {
  time: number;
  hash: string;
  type: 'deposit' | 'withdraw' | 'receive';
  status: 'pending' | 'success' | 'failed';
  usdValue: string;
}

export type AllDexsClearinghouseState = [string, ClearinghouseState][];

export interface PerpsState {
  // positionAndOpenOrders: PositionAndOpenOrder[];
  currentClearinghouseState: ClearinghouseState | null;
  spotState: {
    accountValue: string;
    availableToTrade: string;
  };
  userAbstraction: UserAbstractionResp;
  openOrders: OpenOrder[];
  currentPerpsAccount: Account | null;
  clearinghouseStateMap: Record<string, ClearinghouseState | null>;
  isFetchAllDone: boolean; // init ClearinghouseStateMap has done
  accountNeedApproveAgent: boolean; // 账户是否需要重新approve agent
  accountNeedApproveBuilderFee: boolean; // 账户是否需要重新approve builder fee
  marketData: MarketData[];
  marketDataMap: MarketDataMap;
  hasPermission: boolean;
  perpFee: number;
  isLogin: boolean;
  isInitialized: boolean;
  approveSignatures: ApproveSignatures;
  userFills: WsFill[];
  userAccountHistory: AccountHistoryItem[];
  localLoadingHistory: AccountHistoryItem[];
  wsSubscriptions: (() => void)[];
  pollingTimer: NodeJS.Timeout | null;
  fillsOrderTpOrSl: Record<string, 'tp' | 'sl'>;
  favoriteMarkets: string[];
  homePositionPnl: {
    pnl: number;
    show: boolean;
    type: 'pnl' | 'accountValue';
    accountValue: number;
  };
}

const buildMarketDataMap = (list: MarketData[]): MarketDataMap => {
  return list.reduce((acc, item) => {
    acc[item.name] = item;
    return acc;
  }, {} as MarketDataMap);
};

export const initialState: PerpsState = {
  // positionAndOpenOrders: [],
  openOrders: [],
  currentClearinghouseState: null,
  isFetchAllDone: false,
  spotState: {
    accountValue: '0',
    availableToTrade: '0',
  },
  userAbstraction: UserAbstractionResp.default,
  hasPermission: true,
  perpFee: 0.00045,
  currentPerpsAccount: null,
  clearinghouseStateMap: {},
  accountNeedApproveAgent: false,
  accountNeedApproveBuilderFee: false,
  marketData: [],
  userAccountHistory: [],
  localLoadingHistory: [],
  marketDataMap: {},
  isLogin: false,
  isInitialized: false,
  userFills: [],
  approveSignatures: [],
  wsSubscriptions: [],
  pollingTimer: null,
  favoriteMarkets: [],
  homePositionPnl: {
    pnl: 0,
    accountValue: 0,
    show: false,
    type: 'pnl',
  },
  fillsOrderTpOrSl: {},
};

export const perpsStore = zCreate<PerpsState>(() => ({ ...initialState }));
function setPerpsState(valOrFunc: UpdaterOrPartials<PerpsState>) {
  perpsStore.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(prev, valOrFunc, {
      strict: true,
    });
    if (!changed) {
      return prev;
    }

    return newVal;
  });
}

function unsubscribeAll() {
  setPerpsState(prev => {
    prev.wsSubscriptions.forEach(unsubscribe => {
      try {
        unsubscribe();
      } catch (e) {
        console.error('unsubscribe error', e);
      }
    });

    return {
      ...prev,
      wsSubscriptions: [],
    };
  });
}

function setWsSubscriptions(
  valOrFunc: UpdaterOrPartials<PerpsState['wsSubscriptions']>,
) {
  setPerpsState(prev => {
    const { newVal } = resolveValFromUpdater(prev.wsSubscriptions, valOrFunc, {
      strict: false,
    });
    return { ...prev, wsSubscriptions: newVal };
  });
}

const setInitialized = (payload: boolean) => {
  setPerpsState(prev => ({ ...prev, isInitialized: payload }));
};

const setHasPermission = (payload: boolean) => {
  setPerpsState(prev => ({ ...prev, hasPermission: payload }));
};

const fetchPerpPermission = async (address: string) => {
  const { has_permission } = await openapi.getPerpPermission({ id: address });

  setHasPermission(has_permission);
  // setHasPermission(true);
};

const fetchUserAbstraction = async (address: string) => {
  const sdk = apisPerps.getPerpsSDK();
  const userAbstraction = await sdk.info.getUserAbstraction(address);
  setPerpsState(prev => ({ ...prev, userAbstraction: userAbstraction }));
};

const setIsFetchAllDone = (payload: boolean) => {
  setPerpsState(prev => ({ ...prev, isFetchAllDone: payload }));
};

const setHomePositionPnl = (payload: {
  pnl: number;
  show: boolean;
  type: 'pnl' | 'accountValue';
  accountValue: number;
}) => {
  setPerpsState(prev => ({ ...prev, homePositionPnl: payload }));
};

const setClearinghouseStateMap = (payload: {
  address: string;
  data: ClearinghouseState | null;
}) => {
  const address = payload.address.toLowerCase();
  const { data } = payload;
  const hasPositions =
    data && data.assetPositions && data.assetPositions.length > 0;

  if (!data) {
    return;
  }
  // if (!hasPositions) {
  //   const prevState = perpsStore.getState().clearinghouseStateMap[address];
  //   if (prevState) {
  //     perpsStore.setState(prev => {
  //       const { [address]: _, ...rest } = prev.clearinghouseStateMap;
  //       return { ...prev, clearinghouseStateMap: rest };
  //     });
  //   }
  //   return;
  // }

  const prevState = perpsStore.getState().clearinghouseStateMap[address];
  if (!prevState || data?.time > prevState.time) {
    perpsStore.setState(prev => ({
      ...prev,
      clearinghouseStateMap: { ...prev.clearinghouseStateMap, [address]: data },
    }));
  }
};

export const getClearinghouseStateByMap = (address: string) => {
  return perpsStore.getState().clearinghouseStateMap[address.toLowerCase()];
};

const setCurrentPerpsAccount = (payload: Account) => {
  setPerpsState(prev => ({
    ...prev,
    currentPerpsAccount: payload,
    isLogin: !!payload,
  }));
  perpsService.setCurrentAccount(payload);
};

export const switchPerpsAccountBeforeNavigate = (payload: Account) => {
  const clearinghouseState =
    perpsStore.getState().clearinghouseStateMap[payload.address.toLowerCase()];
  const pnl = clearinghouseState
    ? formatPositionPnl(clearinghouseState)
    : initialState.homePositionPnl;
  setPerpsState(prev => ({
    ...prev,
    currentPerpsAccount: payload,
    isLogin: !!payload,
    isInitialized: false,
    homePositionPnl: pnl,
  }));
  perpsService.setCurrentAccount(payload);
};

const setMarketData = (payload: MarketData[] | []) => {
  const list = payload || [];
  setPerpsState(prev => ({
    ...prev,
    marketData: list,
    marketDataMap: buildMarketDataMap(list as MarketData[]),
  }));
};

const fetchMarketData = async () => {
  const sdk = apisPerps.getPerpsSDK();
  try {
    const fetchTopTokenList = async () => {
      try {
        if (perpsTopTokenCache.length > 0) {
          return perpsTopTokenCache;
        }
        const topAssets = await openapi.getPerpTopTokenList({
          dex_id: 'all',
        });
        if (topAssets.length > 0) {
          perpsTopTokenCache = topAssets;
          return topAssets;
        } else {
          return DEFAULT_TOP_ASSET;
        }
      } catch (error) {
        console.error('Failed to fetch top assets:', error);
        return DEFAULT_TOP_ASSET;
      }
    };

    const [topAssets, marketData, xyzMarketData] = await Promise.all([
      fetchTopTokenList(),
      sdk.info.metaAndAssetCtxs(),
      sdk.info.metaAndAssetCtxs('xyz'),
    ]);
    setMarketData(formatMarkData(marketData, topAssets, xyzMarketData));
  } catch (error) {
    console.error('Failed to fetch market data:', error);
  }
};

const fetchFavoriteMarkets = async () => {
  const favoriteMarkets = await perpsService.getFavoriteMarkets();
  setPerpsState(prev => ({ ...prev, favoriteMarkets }));
};

export const addFavoriteMarket = (market: string) => {
  const normalizedMarket = market.toUpperCase();
  if (perpsStore.getState().favoriteMarkets.includes(normalizedMarket)) {
    return;
  }
  setPerpsState(prev => ({
    ...prev,
    favoriteMarkets: [...prev.favoriteMarkets, normalizedMarket.toUpperCase()],
  }));
  perpsService.addFavoriteMarket(normalizedMarket);
};

export const removeFavoriteMarket = (market: string) => {
  const normalizedMarket = market.toUpperCase();
  setPerpsState(prev => ({
    ...prev,
    favoriteMarkets: prev.favoriteMarkets.filter(m => m !== normalizedMarket),
  }));
  perpsService.removeFavoriteMarket(normalizedMarket);
};

const handleSelectDefaultAccount = async (accounts: Account[]) => {
  setInitialized(false);
  try {
    const sdk = apisPerps.getPerpsSDK();
    const currentAccount = await apisPerps.getPerpsCurrentAccount();
    const lastUsedAccount = await apisPerps.getPerpsLastUsedAccount();
    const recentlyAccount = currentAccount || lastUsedAccount;
    const selectedItem =
      accounts.find(
        item =>
          isSameAddress(item.address, recentlyAccount?.address || '') &&
          item.type === recentlyAccount?.type,
      ) ||
      accounts.find(item =>
        isSameAddress(item.address, recentlyAccount?.address || ''),
      );
    const perpsState = perpsStore.getState();

    const handleDoneSelectAccount = (account: Account) => {
      setCurrentPerpsAccount(account);
      const clearinghouseState =
        perpsState.clearinghouseStateMap[account.address.toLowerCase()];
      const pnl = clearinghouseState
        ? formatPositionPnl(clearinghouseState)
        : initialState.homePositionPnl;
      setHomePositionPnl(pnl);
      sdk.initAccount(account.address);
      subscribeToUserData(account);
    };

    if (recentlyAccount && selectedItem) {
      handleDoneSelectAccount(selectedItem);
    } else {
      if (accounts.length > 0) {
        const res = accounts.map(item => {
          const info =
            perpsState.clearinghouseStateMap[item.address.toLowerCase()];
          return { account: item, clearinghouseState: info };
        });
        const best = res.sort((a, b) => {
          return (
            Number(b.clearinghouseState?.marginSummary.accountValue) -
            Number(a.clearinghouseState?.marginSummary.accountValue)
          );
        })[0];
        if (
          best &&
          Number(best.clearinghouseState?.marginSummary.accountValue) > 0
        ) {
          handleDoneSelectAccount(best.account);
        } else {
          handleDoneSelectAccount(accounts[0]!);
        }
      }
    }
  } catch (e) {
    setCurrentPerpsAccount(accounts[0]!);
    setHomePositionPnl(initialState.homePositionPnl);
    console.error('Error selecting only show account', e);
  }
};

const setAccountNeedApproveAgent = (payload: boolean) => {
  setPerpsState(prev => ({ ...prev, accountNeedApproveAgent: payload }));
};

const setAccountNeedApproveBuilderFee = (payload: boolean) => {
  setPerpsState(prev => ({ ...prev, accountNeedApproveBuilderFee: payload }));
};

const resetAccountState = () => {
  setPerpsState(prev => ({
    ...prev,
    // positionAndOpenOrders: [],
    currentPerpsAccount: null,
    isLogin: false,
    userAbstraction: UserAbstractionResp.default,
    userAccountHistory: [],
    localLoadingHistory: [],
    userFills: [],
    perpFee: 0.00045,
    approveSignatures: [],
    fillsOrderTpOrSl: {},
    hasPermission: true,
    homePositionPnl: {
      pnl: 0,
      show: false,
      type: 'accountValue',
      accountValue: 0,
    },
    accountNeedApproveAgent: false,
    accountNeedApproveBuilderFee: false,
  }));
};

const fetchUserFillHistory = async () => {
  const sdk = apisPerps.getPerpsSDK();
  const res = await sdk.info.getUserFills();
  setPerpsState(prev => ({
    ...prev,
    userFills: (res as unknown as WsFill[]).slice(0, 2000),
  }));
};

const addUserFills = (payload: {
  fills: WsFill[];
  isSnapshot?: boolean;
  user: string;
}) => {
  const { fills, isSnapshot } = payload;
  if (isSnapshot) {
    fetchUserFillHistory();
  }

  setPerpsState(prev => ({
    ...prev,
    userFills: isSnapshot ? fills : [...fills, ...prev.userFills],
  }));
};

const mapLedgerUpdatesToHistory = (
  list: UserNonFundingLedgerUpdates[],
  currentAddress?: string,
): AccountHistoryItem[] => {
  return list
    .filter(item => {
      return (
        item.delta.type === 'deposit' ||
        item.delta.type === 'withdraw' ||
        item.delta.type === 'send' ||
        item.delta.type === 'internalTransfer' ||
        item.delta.type === 'accountClassTransfer'
      );
    })
    .map(item => {
      if (item.delta.type === 'internalTransfer') {
        const fee = (item.delta as any).fee as string;
        const realUsdValue = Number(item.delta.usdc) - Number(fee || '0');
        return {
          time: item.time,
          hash: item.hash,
          type: 'receive' as const,
          status: 'success' as const,
          usdValue: realUsdValue.toString(),
        };
      }

      const { destination, usdcValue } = item.delta as any;
      if (
        item.delta.type === 'send' &&
        isSameAddress(destination, HYPE_EVM_BRIDGE_ADDRESS)
      ) {
        return {
          time: item.time,
          hash: item.hash,
          type: 'withdraw' as const,
          status: 'success' as const,
          usdValue: usdcValue?.toString() || '0',
        };
      }
      if (
        item.delta.type === 'send' &&
        currentAddress &&
        isSameAddress(destination, currentAddress)
      ) {
        return {
          time: item.time,
          hash: item.hash,
          type: 'receive' as const,
          status: 'success' as const,
          usdValue: usdcValue.toString(),
        };
      }

      const type =
        item.delta.type === 'accountClassTransfer'
          ? item.delta.toPerp
            ? 'deposit'
            : 'withdraw'
          : item.delta.type;

      return {
        time: item.time,
        hash: item.hash,
        type: type as 'deposit' | 'withdraw',
        status: 'success' as const,
        usdValue: item.delta.usdc || (item.delta as any).usdcValue || '0',
      };
    });
};

const fetchUserNonFundingLedgerUpdates = async () => {
  const sdk = apisPerps.getPerpsSDK();
  try {
    const res = await sdk.info.getUserNonFundingLedgerUpdates();
    const state = perpsStore.getState();
    const list = mapLedgerUpdatesToHistory(
      res,
      state.currentPerpsAccount?.address,
    );

    setPerpsState(prev => ({
      ...prev,
      userAccountHistory: list,
    }));
  } catch (error) {
    console.error('Failed to fetch user non-funding ledger updates:', error);
  }
};

const setUserNonFundingLedgerUpdates = (payload: {
  list: UserNonFundingLedgerUpdates[];
  isSnapshot?: boolean;
}) => {
  const { list, isSnapshot } = payload;
  const state = perpsStore.getState();
  const newList = mapLedgerUpdatesToHistory(
    list,
    state.currentPerpsAccount?.address,
  );
  if (isSnapshot) {
    fetchUserNonFundingLedgerUpdates();
    setPerpsState(prev => ({
      ...prev,
      userAccountHistory: newList,
    }));
    return;
  }

  let filteredLocalHistory = [...state.localLoadingHistory];
  newList.forEach(item => {
    filteredLocalHistory = filteredLocalHistory.filter(i => {
      return i.type !== item.type;
    });
  });

  setPerpsState(prev => ({
    ...prev,
    localLoadingHistory: filteredLocalHistory,
    userAccountHistory: [...newList, ...prev.userAccountHistory],
  }));
};

const updateMarketData = (payload: [string, AssetCtx[]][]) => {
  if (payload.length === 0) {
    return;
  }

  const marketByDexName: Record<string, AssetCtx[]> = {};
  payload.forEach(item => {
    const [dexId, assetCtx] = item;
    const dexName = dexId ? dexId : 'hyperliquid';
    marketByDexName[dexName] = assetCtx;
  });
  setPerpsState(prev => {
    const newMarketData = prev.marketData.map(item => {
      // other dex , example xyz is error
      const dexName = item.dexId ? item.dexId : 'hyperliquid';
      const assetCtx = marketByDexName[dexName];
      return {
        ...item,
        ...assetCtx?.[item.index],
      };
    });
    return {
      ...prev,
      marketData: newMarketData,
      marketDataMap: buildMarketDataMap(newMarketData),
    };
  });
};

const subscribeToUserData = (account: Account) => {
  const sdk = apisPerps.getPerpsSDK();
  const address = account.address;
  unsubscribeAll();
  const { unsubscribe: unsubscribeClearinghouseState } =
    sdk.ws.subscribeToAllDexsClearinghouseState(address, data => {
      const { clearinghouseStates, user } = data;
      if (!isSameAddress(user, address)) {
        return;
      }
      const currentClearinghouseState =
        formatAllDexsClearinghouseState(clearinghouseStates);
      setPerpsState(prev => ({
        ...prev,
        homePositionPnl: formatPositionPnl(currentClearinghouseState!),
        currentClearinghouseState: currentClearinghouseState,
      }));
    });

  const { unsubscribe: unsubscribeSpotState } = sdk.ws.subscribeToSpotState(
    data => {
      const { spotState, user } = data;
      if (!isSameAddress(user, address) || !spotState) {
        return;
      }
      setPerpsState(prev => ({
        ...prev,
        spotState: formatSpotState(spotState),
      }));
    },
  );

  const { unsubscribe: unsubscribeOpenOrders } = sdk.ws.subscribeToOpenOrders(
    data => {
      const { orders, user } = data;
      if (!isSameAddress(user, address) || !orders) {
        return;
      }

      setPerpsState(prev => ({ ...prev, openOrders: orders }));
    },
  );

  const { unsubscribe: unsubscribeAllDexsAssetCtxs } =
    sdk.ws.subscribeToAllDexsAssetCtxs(data => {
      const { ctxs } = data;
      updateMarketData(ctxs);
    });

  const { unsubscribe: unsubscribeFills } = sdk.ws.subscribeToUserFills(
    data => {
      // Only process data when app is active
      console.log('User fills update:', data.fills.length);
      const { fills, isSnapshot, user } = data;
      if (!isSameAddress(user, address)) {
        return;
      }

      addUserFills({
        fills,
        isSnapshot: isSnapshot || false,
        user,
      });
    },
  );

  const { unsubscribe: unsubscribeUserNonFundingLedgerUpdates } =
    sdk.ws.subscribeToUserNonFundingLedgerUpdates(data => {
      const { nonFundingLedgerUpdates, user, isSnapshot } = data;
      if (!isSameAddress(user, address)) {
        return;
      }

      setUserNonFundingLedgerUpdates({
        list: nonFundingLedgerUpdates,
        isSnapshot: isSnapshot || false,
      });
    });

  setWsSubscriptions(prev => {
    return [
      ...prev,
      // unsubscribeWebData2,
      unsubscribeClearinghouseState,
      unsubscribeSpotState,
      unsubscribeAllDexsAssetCtxs,
      unsubscribeOpenOrders,
      unsubscribeFills,
      unsubscribeUserNonFundingLedgerUpdates,
    ];
  });
};

export const apisPerpsStore = {
  logout: () => {
    unsubscribeAll();
    resetAccountState();
    fetchPerpPermission('');
  },
};

export const usePerpsStore = () => {
  const state = perpsStore(s => s);

  const setFillsOrderTpOrSl = useMemoizedFn(
    (payload: Record<string, 'tp' | 'sl'>) => {
      setPerpsState(prev => ({ ...prev, fillsOrderTpOrSl: payload }));
    },
  );

  // Reducers 转换为 setState 操作
  const setLocalLoadingHistory = useMemoizedFn(
    (payload: AccountHistoryItem[], isReset: boolean = false) => {
      setPerpsState(prev => {
        if (isReset) {
          return { ...prev, localLoadingHistory: payload };
        }
        // If WS already delivered a confirmed entry for this type,
        // skip adding the pending item (WS arrived before HTTP response)
        const filtered = payload.filter(item => {
          return !prev.userAccountHistory.some(
            h => h.type === item.type && h.time >= item.time,
          );
        });
        if (filtered.length === 0) {
          return prev;
        }
        return {
          ...prev,
          localLoadingHistory: [...filtered, ...prev.localLoadingHistory],
        };
      });
    },
  );

  const setUserAccountHistory = useMemoizedFn(
    (payload: AccountHistoryItem[]) => {
      setPerpsState(prev => ({ ...prev, userAccountHistory: payload }));
    },
  );

  const setUserFills = useMemoizedFn((payload: WsFill[]) => {
    setPerpsState(prev => ({ ...prev, userFills: payload }));
  });

  const setPerpFee = useMemoizedFn((payload: number) => {
    setPerpsState(prev => ({ ...prev, perpFee: payload }));
  });

  const setApproveSignatures = useMemoizedFn((payload: ApproveSignatures) => {
    setPerpsState(prev => ({ ...prev, approveSignatures: payload }));
  });

  const loginPerpsAccount = useMemoizedFn(async (account: Account) => {
    apisPerps.setPerpsCurrentAccount(account);
    setCurrentPerpsAccount(account);
    refreshData();
    subscribeToUserData(account);
    fetchUserNonFundingLedgerUpdates();
    fetchPerpPermission(account.address);
    setPerpsState(prev => ({
      ...prev,
      userAbstraction: UserAbstractionResp.default,
    }));
    fetchUserAbstraction(account.address);

    setTimeout(() => {
      fetchPerpFee();
    }, 1000);
    console.log('loginPerpsAccount success', account.address);
  });

  // may can remove
  const fetchClearinghouseState = useMemoizedFn(async () => {
    const sdk = apisPerps.getPerpsSDK();
    try {
      // const clearinghouseState = await sdk.info.getClearingHouseState();
      // updatePositionsWithClearinghouse(clearinghouseState);
    } catch (error) {
      console.error('Failed to fetch clearinghouse state:', error);
    }
  });

  // maybe can remove
  const fetchPositionOpenOrders = useMemoizedFn(async () => {
    const sdk = apisPerps.getPerpsSDK();
    // const openOrders = await sdk.info.getFrontendOpenOrders();
    // updateOpenOrders(openOrders);
  });

  const fetchUserHistoricalOrders = useMemoizedFn(async () => {
    try {
      const sdk = apisPerps.getPerpsSDK();
      const res = await sdk.info.getUserHistoricalOrders(
        undefined, // use sdk inner address
        Date.now() - 1000 * 60 * 60 * 24 * 7, // 7 days ago
        0,
      );
      const listOrderTpOrSl = {} as Record<string, 'tp' | 'sl'>;
      res.forEach(item => {
        if (item.status !== 'triggered') {
          return null;
        }
        if (item.order.reduceOnly && item.order.isTrigger) {
          if (
            item.order.orderType === 'Take Profit Market' ||
            item.order.orderType === 'Stop Market'
          ) {
            listOrderTpOrSl[item.order.oid] =
              item.order.orderType === 'Stop Market' ? 'sl' : 'tp';
          }
        }
      });

      setFillsOrderTpOrSl(listOrderTpOrSl);
    } catch (error) {
      console.error('Failed to fetch user historical orders:', error);
    }
  });

  const refreshData = useMemoizedFn(async () => {
    // await fetchPositionAndOpenOrders();
    // await is login is too low
    await fetchUserHistoricalOrders();
  });

  const fetchPerpFee = useMemoizedFn(async () => {
    const sdk = apisPerps.getPerpsSDK();
    try {
      const res = await sdk.info.getUsersFees();
      const perpFee =
        Number(res.userCrossRate) * (1 - Number(res.activeReferralDiscount));
      const fee = perpFee.toFixed(6);
      setPerpFee(Number(fee));
      return Number(fee);
    } catch (error) {
      console.error('Failed to fetch perp fee:', error);
      return 0.00045;
    }
  });

  return {
    // State
    state,
    setState: setPerpsState,

    // Reducers
    setFillsOrderTpOrSl,
    setHomePositionPnl,
    setHasPermission,
    setLocalLoadingHistory,
    setUserAccountHistory,
    setUserFills,
    addUserFills,
    setPerpFee,
    setMarketData,
    setCurrentPerpsAccount,
    setAccountNeedApproveAgent,
    setAccountNeedApproveBuilderFee,
    setInitialized,
    setApproveSignatures,
    resetAccountState,

    // Effects
    // fetchPositionAndOpenOrders,
    fetchPerpPermission,
    loginPerpsAccount,
    fetchClearinghouseState,
    fetchPositionOpenOrders,
    fetchUserHistoricalOrders,
    refreshData,
    fetchMarketData,
    fetchPerpFee,
    unsubscribeAll,
  };
};

runIIFEFunc(fetchMarketData);
runIIFEFunc(fetchFavoriteMarkets);

export function startSubscribePerpsOnAppState() {
  const subscription = AppState.addEventListener('change', nextAppState => {
    // Pass the state string ('active', 'background', 'inactive') directly
    apisPerps.getPerpsSDK().ws.handleAppStateChange(nextAppState);
  });

  return () => {
    subscription.remove();
  };
}

export const useSubscribePosition = (sortedAccounts: Account[]) => {
  const { top10Accounts } = useMemo(() => {
    const unionAddresses = unionBy(sortedAccounts, account =>
      account.address.toLowerCase(),
    );
    return {
      top10Accounts: unionAddresses.slice(0, 10),
    };
  }, [sortedAccounts]);
  const isMounted = useRef(false);
  const currentHasFetchAddresses = useRef<string[]>([]);
  const hasSelectedDefaultAccount = useRef(false);
  const top10SubscriptionRef = useRef<(() => void) | null>(null);
  const top10TimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const addAddressesSubscriptionsRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    const handleLogout = (account: Account | null) => {
      const remainAccounts = top10Accounts.filter(
        item =>
          !(
            isSameAddress(item.address, account?.address || '') &&
            item.type === account?.type
          ),
      );
      handleSelectDefaultAccount(remainAccounts);
    };

    eventBus.on(EVENTS.PERPS.LOG_OUT, handleLogout);
    return () => {
      eventBus.removeListener(EVENTS.PERPS.LOG_OUT, handleLogout);
    };
  }, [top10Accounts]);

  useEffect(() => {
    const handleAddAddresses = (addresses: string[]) => {
      const sdk = apisPerps.getPerpsSDK();
      const { unsubscribe } = sdk.ws.subscribeToAllDexsClearinghouseState(
        addresses,
        data => {
          setClearinghouseStateMap({
            address: data.user,
            data: formatAllDexsClearinghouseState(data.clearinghouseStates),
          });
        },
      );

      addAddressesSubscriptionsRef.current.push(unsubscribe);
    };

    eventBus.on('PERPS_ADD_ADDRESSES', handleAddAddresses);

    return () => {
      eventBus.removeListener('PERPS_ADD_ADDRESSES', handleAddAddresses);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (top10TimeoutRef.current) {
        clearTimeout(top10TimeoutRef.current);
        top10TimeoutRef.current = null;
      }

      top10SubscriptionRef.current?.();
      top10SubscriptionRef.current = null;

      addAddressesSubscriptionsRef.current.forEach(unsubscribe => {
        unsubscribe();
      });
      addAddressesSubscriptionsRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (isMounted.current) {
      return;
    }
    if (top10Accounts && top10Accounts.length > 0) {
      isMounted.current = true;
      const sdk = apisPerps.getPerpsSDK();
      // maybe websocket is bad, no fetch data
      top10TimeoutRef.current = setTimeout(() => {
        top10TimeoutRef.current = null;
        if (!hasSelectedDefaultAccount.current) {
          hasSelectedDefaultAccount.current = true;
          handleSelectDefaultAccount(top10Accounts);
        }
      }, 5 * 1000);
      const top10Addresses = top10Accounts.map(item => item.address);
      const { unsubscribe } = sdk.ws.subscribeToAllDexsClearinghouseState(
        top10Addresses,
        data => {
          if (!currentHasFetchAddresses.current.includes(data.user)) {
            currentHasFetchAddresses.current.push(data.user);
            if (
              currentHasFetchAddresses.current.length === top10Addresses.length
            ) {
              setIsFetchAllDone(true);
              if (top10TimeoutRef.current) {
                clearTimeout(top10TimeoutRef.current);
                top10TimeoutRef.current = null;
              }
              if (!hasSelectedDefaultAccount.current) {
                hasSelectedDefaultAccount.current = true;
                handleSelectDefaultAccount(top10Accounts);
              }
            }
          }
          setClearinghouseStateMap({
            address: data.user,
            data: formatAllDexsClearinghouseState(data.clearinghouseStates),
          });
        },
      );

      top10SubscriptionRef.current = unsubscribe;
    }
  }, [top10Accounts]);
};
