import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useMemoizedFn } from 'ahooks';
import {
  AssetCtx,
  AssetPosition,
  ClearinghouseState,
  MarginSummary,
  OpenOrder,
  WsFill,
} from '@rabby-wallet/hyperliquid-sdk';
// import { ApproveSignatures } from '@/background/service/perps';
import { Account } from '@/core/services/preference';
import { ApproveSignatures } from '@/core/services/perpsService';
import { DEFAULT_TOP_ASSET } from '@/constant/perps';
import { apisPerps } from '@/core/apis';
import { formatMarkData, formatPositionPnl } from '@/utils/perps';
import { eventBus, EVENTS } from '@/utils/events';
import { openapi } from '@/core/request';
import { maxBy, unionBy } from 'lodash';
import { zCreate } from '@/core/utils/reexports';
import {
  resolveValFromUpdater,
  runIIFEFunc,
  UpdaterOrPartials,
} from '@/core/utils/store';
import { AppState } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { perpsService } from '@/core/services';

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
  dayBaseVlm: string;
  dayNtlVlm: string;
  funding: string;
  markPx: string;
  midPx: string;
  openInterest: string;
  oraclePx: string;
  premium: string;
  prevDayPx: string;
}

export type MarketDataMap = Record<string, MarketData>;

export interface AccountHistoryItem {
  time: number;
  hash: string;
  type: 'deposit' | 'withdraw' | 'receive';
  status: 'pending' | 'success' | 'failed';
  usdValue: string;
}

export interface PerpsState {
  positionAndOpenOrders: PositionAndOpenOrder[];
  accountSummary: AccountSummary | null;
  currentClearinghouseState: ClearinghouseState | null;
  currentPerpsAccount: Account | null;
  clearinghouseStateMap: Record<string, ClearinghouseState | null>;
  isFetchAllDone: boolean; // init clearinghouseStateMap has done
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
    acc[item.name.toUpperCase()] = item;
    return acc;
  }, {} as MarketDataMap);
};

export const initialState: PerpsState = {
  positionAndOpenOrders: [],
  accountSummary: null,
  currentClearinghouseState: null,
  isFetchAllDone: false,
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
  data: ClearinghouseState;
}) => {
  const address = payload.address.toLowerCase();
  const { data } = payload;
  const prevState = perpsStore.getState().clearinghouseStateMap[address];
  if (!prevState || data.time > prevState.time) {
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

const fetchMarketData = async (canUseCache = true) => {
  const sdk = apisPerps.getPerpsSDK();
  try {
    const fetchTopTokenList = async () => {
      try {
        const topAssets = await openapi.getPerpTopTokenList();
        if (topAssets.length > 0) {
          return topAssets;
        } else {
          return DEFAULT_TOP_ASSET;
        }
      } catch (error) {
        console.error('Failed to fetch top assets:', error);
        return DEFAULT_TOP_ASSET;
      }
    };

    const [topAssets, marketData] = await Promise.all([
      fetchTopTokenList(),
      sdk.info.metaAndAssetCtxs(canUseCache),
    ]);
    setMarketData(formatMarkData(marketData, topAssets));
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
    if (recentlyAccount && selectedItem) {
      setCurrentPerpsAccount(selectedItem);
      const clearinghouseState =
        perpsState.clearinghouseStateMap[selectedItem.address.toLowerCase()];
      const pnl = clearinghouseState
        ? formatPositionPnl(clearinghouseState)
        : initialState.homePositionPnl;
      setHomePositionPnl(pnl);
      sdk.initAccount(selectedItem.address);
      subscribeToUserData(selectedItem.address);
    } else {
      if (accounts.length > 0) {
        const res = accounts.map(item => {
          const info =
            perpsState.clearinghouseStateMap[item.address.toLowerCase()];
          return { account: item, clearinghouseState: info };
        });
        const best = res.sort((a, b) => {
          return (
            Number(b.clearinghouseState?.marginSummary.accountValue || 0) -
            Number(a.clearinghouseState?.marginSummary.accountValue || 0)
          );
        })[0];
        if (
          best &&
          Number(best.clearinghouseState?.marginSummary.accountValue || 0) > 0
        ) {
          setCurrentPerpsAccount(best.account);
          const pnl = best.clearinghouseState
            ? formatPositionPnl(best.clearinghouseState)
            : initialState.homePositionPnl;
          setHomePositionPnl(pnl);
          sdk.initAccount(best.account.address);
          subscribeToUserData(best.account.address);
        } else {
          setCurrentPerpsAccount(accounts[0]!);
          const clearinghouseState =
            perpsState.clearinghouseStateMap[
              accounts[0]!.address.toLowerCase()
            ];
          const pnl = clearinghouseState
            ? formatPositionPnl(clearinghouseState)
            : initialState.homePositionPnl;
          setHomePositionPnl(pnl);
          sdk.initAccount(accounts[0]!.address);
          subscribeToUserData(accounts[0]!.address);
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
    accountSummary: null,
    positionAndOpenOrders: [],
    currentPerpsAccount: null,
    isLogin: false,
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

const addUserFills = (payload: {
  fills: WsFill[];
  isSnapshot?: boolean;
  user: string;
}) => {
  const { fills, isSnapshot } = payload;
  setPerpsState(prev => ({
    ...prev,
    userFills: isSnapshot
      ? fills.slice(0, 2000)
      : [...fills, ...prev.userFills],
  }));
};

const setPositionAndOpenOrders = (
  clearinghouseState: ClearinghouseState,
  openOrders: OpenOrder[],
) => {
  setPerpsState(prev => ({
    ...prev,
    accountSummary: {
      ...clearinghouseState.marginSummary,
      withdrawable: clearinghouseState.withdrawable,
    },
    currentClearinghouseState: clearinghouseState,
    positionAndOpenOrders: clearinghouseState.assetPositions.map(position => ({
      ...position,
      openOrders: openOrders.filter(
        order => order.coin === position.position.coin,
      ),
    })),
    homePositionPnl: formatPositionPnl(clearinghouseState),
  }));
};

const updateMarketData = (payload: AssetCtx[]) => {
  setPerpsState(prev => {
    const list = payload || [];
    const newMarketData = prev.marketData.map(item => {
      return {
        ...item,
        ...list[item.index],
      };
    });
    return {
      ...prev,
      marketData: newMarketData,
      marketDataMap: buildMarketDataMap(newMarketData),
    };
  });
};

const subscribeToUserData = (address: string) => {
  const sdk = apisPerps.getPerpsSDK();

  unsubscribeAll();
  const { unsubscribe: unsubscribeWebData2 } = sdk.ws.subscribeToWebData2(
    data => {
      const { clearinghouseState, assetCtxs, openOrders, serverTime, user } =
        data;
      if (!isSameAddress(user, address)) {
        return;
      }

      setPositionAndOpenOrders(clearinghouseState, openOrders);

      updateMarketData(assetCtxs);
    },
  );

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

  setWsSubscriptions(prev => {
    return [...prev, unsubscribeWebData2, unsubscribeFills];
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
      setPerpsState(prev => ({
        ...prev,
        localLoadingHistory: isReset
          ? payload
          : [...payload, ...prev.localLoadingHistory],
      }));
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

  const updatePositionsWithClearinghouse = useMemoizedFn(
    (payload: ClearinghouseState) => {
      setPerpsState(prev => {
        const openOrders = prev.positionAndOpenOrders.flatMap(
          order => order.openOrders,
        );

        const positionAndOpenOrders = payload.assetPositions.map(position => ({
          ...position,
          openOrders: openOrders.filter(
            order => order.coin === position.position.coin,
          ),
        }));

        return {
          ...prev,
          accountSummary: {
            ...payload.marginSummary,
            withdrawable: payload.withdrawable,
          },
          currentClearinghouseState: payload,
          positionAndOpenOrders,
          homePositionPnl: formatPositionPnl(payload),
        };
      });
    },
  );

  const updateUserAccountHistory = useMemoizedFn(
    (payload: { newHistoryList: AccountHistoryItem[] }) => {
      if (payload.newHistoryList.length === 0) {
        return state;
      }
      const { newHistoryList } = payload;
      const depositList = newHistoryList.filter(
        item => item.type === 'deposit',
      );
      const withdrawList = newHistoryList.filter(
        item => item.type === 'withdraw',
      );
      const receiveList = newHistoryList.filter(
        item => item.type === 'receive',
      );
      const maxTimeItemDeposit = maxBy(depositList, 'time');
      const maxTimeItemWithdraw = maxBy(withdrawList, 'time');
      const maxTimeItemReceive = maxBy(receiveList, 'time');
      setPerpsState(prev => {
        // 使用当前userAccountHistory过滤 localLoadingHistory
        const filteredLocalHistory = state.localLoadingHistory.filter(item => {
          if (item.type === 'deposit') {
            return item.time >= (maxTimeItemDeposit?.time || 0);
          } else if (item.type === 'withdraw') {
            return item.time >= (maxTimeItemWithdraw?.time || 0);
          } else {
            return item.time >= (maxTimeItemReceive?.time || 0);
          }
        });
        return {
          ...prev,
          userAccountHistory: newHistoryList,
          localLoadingHistory: filteredLocalHistory,
        };
      });
    },
  );

  const setPerpFee = useMemoizedFn((payload: number) => {
    setPerpsState(prev => ({ ...prev, perpFee: payload }));
  });

  const updateOpenOrders = useMemoizedFn((payload: OpenOrder[]) => {
    setPerpsState(prev => {
      const positionAndOpenOrders = prev.positionAndOpenOrders.map(order => {
        return {
          ...order,
          openOrders: payload.filter(item => item.coin === order.position.coin),
        };
      });
      return {
        ...state,
        positionAndOpenOrders,
      };
    });
  });

  const setAccountSummary = useMemoizedFn((payload: AccountSummary | null) => {
    setPerpsState(prev => ({ ...prev, accountSummary: payload }));
  });

  const setCurrentClearinghouseState = useMemoizedFn(
    (payload: ClearinghouseState) => {
      setPerpsState(prev => ({ ...prev, currentClearinghouseState: payload }));
    },
  );

  const setApproveSignatures = useMemoizedFn((payload: ApproveSignatures) => {
    setPerpsState(prev => ({ ...prev, approveSignatures: payload }));
  });

  // Effects 转换为异步函数
  // const saveApproveSignatures = useMemoizedFn(
  //   async (payload: {
  //     approveSignatures: ApproveSignatures;
  //     address: string;
  //   }) => {
  //     setApproveSignatures(payload.approveSignatures);
  //     apisPerps.setSendApproveAfterDeposit(
  //       payload.address,
  //       payload.approveSignatures,
  //     );
  //   },
  // );

  const fetchPositionAndOpenOrders = useMemoizedFn(async (address?: string) => {
    const sdk = apisPerps.getPerpsSDK();
    try {
      const [clearinghouseState, openOrders] = await Promise.all([
        sdk.info.getClearingHouseState(address),
        sdk.info.getFrontendOpenOrders(address),
      ]);

      setPositionAndOpenOrders(clearinghouseState, openOrders);
      setAccountSummary({
        ...clearinghouseState.marginSummary,
        withdrawable: clearinghouseState.withdrawable,
      });
      setCurrentClearinghouseState(clearinghouseState);
    } catch (error: any) {
      console.error('Failed to fetch clearinghouse state:', error);
    }
  });

  const loginPerpsAccount = useMemoizedFn(async (account: Account) => {
    apisPerps.setPerpsCurrentAccount(account);
    setCurrentPerpsAccount(account);
    await refreshData();
    subscribeToUserData(account.address);
    fetchPerpPermission(account.address);
    setTimeout(() => {
      fetchPerpFee();
    }, 1000);
    console.log('loginPerpsAccount success', account.address);
  });

  const fetchClearinghouseState = useMemoizedFn(async () => {
    const sdk = apisPerps.getPerpsSDK();
    try {
      const clearinghouseState = await sdk.info.getClearingHouseState();
      updatePositionsWithClearinghouse(clearinghouseState);
    } catch (error) {
      console.error('Failed to fetch clearinghouse state:', error);
    }
  });

  const fetchPositionOpenOrders = useMemoizedFn(async () => {
    const sdk = apisPerps.getPerpsSDK();
    const openOrders = await sdk.info.getFrontendOpenOrders();
    updateOpenOrders(openOrders);
  });

  const fetchUserNonFundingLedgerUpdates = useMemoizedFn(async () => {
    const sdk = apisPerps.getPerpsSDK();
    try {
      const res = await sdk.info.getUserNonFundingLedgerUpdates();

      const list = res
        .filter(item => {
          if (
            item.delta.type === 'deposit' ||
            item.delta.type === 'withdraw' ||
            item.delta.type === 'internalTransfer' ||
            item.delta.type === 'accountClassTransfer'
          ) {
            return true;
          }
          return false;
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
            usdValue: item.delta.usdc || '0',
          };
        });

      updateUserAccountHistory({ newHistoryList: list });
    } catch (error) {
      console.error('Failed to fetch user non-funding ledger updates:', error);
    }
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
    await fetchPositionAndOpenOrders();
    // await is login is too low
    fetchUserNonFundingLedgerUpdates();
    fetchUserHistoricalOrders();
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
    setClearinghouseStateMap,
    setUserAccountHistory,
    setUserFills,
    addUserFills,
    updatePositionsWithClearinghouse,
    updateUserAccountHistory,
    setPerpFee,
    setMarketData,
    setPositionAndOpenOrders,
    updateOpenOrders,
    setAccountSummary,
    setCurrentPerpsAccount,
    setAccountNeedApproveAgent,
    setAccountNeedApproveBuilderFee,
    setInitialized,
    setApproveSignatures,
    resetAccountState,

    // Effects
    fetchPositionAndOpenOrders,
    fetchPerpPermission,
    loginPerpsAccount,
    fetchClearinghouseState,
    fetchPositionOpenOrders,
    fetchUserNonFundingLedgerUpdates,
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
  const sdk = apisPerps.getPerpsSDK();
  const subscription = AppState.addEventListener('change', nextAppState => {
    // Pass the state string ('active', 'background', 'inactive') directly
    sdk.ws.handleAppStateChange(nextAppState);
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

  useEffect(() => {
    eventBus.on(EVENTS.PERPS.LOG_OUT, (account: Account | null) => {
      const remainAccounts = top10Accounts.filter(
        item =>
          !(
            isSameAddress(item.address, account?.address || '') &&
            item.type === account?.type
          ),
      );
      handleSelectDefaultAccount(remainAccounts);
    });
    return () => {
      eventBus.removeAllListeners(EVENTS.PERPS.LOG_OUT);
    };
  }, [top10Accounts]);

  useEffect(() => {
    eventBus.on('PERPS_ADD_ADDRESSES', (addresses: string[]) => {
      const sdk = apisPerps.getPerpsSDK();
      sdk.ws.subscribeToClearinghouseState(addresses, data => {
        const clearinghouseState = data.clearinghouseState;
        if (
          +clearinghouseState?.withdrawable > 0 ||
          +clearinghouseState?.marginSummary.accountValue > 0
        ) {
          setClearinghouseStateMap({
            address: data.user,
            data: clearinghouseState,
          });
        }
      });
    });

    return () => {
      eventBus.removeAllListeners('PERPS_ADD_ADDRESSES');
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
      let timeout = setTimeout(() => {
        if (!hasSelectedDefaultAccount.current) {
          hasSelectedDefaultAccount.current = true;
          handleSelectDefaultAccount(top10Accounts);
        }
      }, 5 * 1000);
      const top10Addresses = top10Accounts.map(item => item.address);
      sdk.ws.subscribeToClearinghouseState(top10Addresses, data => {
        if (!currentHasFetchAddresses.current.includes(data.user)) {
          currentHasFetchAddresses.current.push(data.user);
          if (
            currentHasFetchAddresses.current.length === top10Addresses.length
          ) {
            setIsFetchAllDone(true);
            clearTimeout(timeout);
            if (!hasSelectedDefaultAccount.current) {
              hasSelectedDefaultAccount.current = true;
              handleSelectDefaultAccount(top10Accounts);
            }
          }
        }
        const clearinghouseState = data.clearinghouseState;
        if (
          +clearinghouseState?.withdrawable > 0 ||
          +clearinghouseState?.marginSummary.accountValue > 0
        ) {
          setClearinghouseStateMap({
            address: data.user,
            data: clearinghouseState,
          });
        }
      });
    }
  }, [top10Accounts]);
};
