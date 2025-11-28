import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { useState, useEffect, useRef } from 'react';
import { useMemoizedFn } from 'ahooks';
import {
  AssetCtx,
  AssetPosition,
  ClearinghouseState,
  MarginSummary,
  OpenOrder,
  WsFill,
} from '@rabby-wallet/hyperliquid-sdk';
import { useAppState } from '@react-native-community/hooks';
// import { ApproveSignatures } from '@/background/service/perps';
import { atom, useAtom } from 'jotai';
import { Account } from '@/core/services/preference';
import { ApproveSignatures } from '@/core/services/perpsService';
import { DEFAULT_TOP_ASSET } from '@/constant/perps';
import { apisPerps } from '@/core/apis';
import { formatMarkData } from '@/utils/perps';
import { eventBus, EVENTS } from '@/utils/events';
import { openapi } from '@/core/request';
import { maxBy } from 'lodash';

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
  currentPerpsAccount: Account | null;
  currentOnlyShowPerpsAccount: Account | null;
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

const initialState: PerpsState = {
  positionAndOpenOrders: [],
  accountSummary: null,
  hasPermission: true,
  perpFee: 0.00045,
  currentPerpsAccount: null,
  currentOnlyShowPerpsAccount: null,
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
  homePositionPnl: {
    pnl: 0,
    accountValue: 0,
    show: false,
    type: 'pnl',
  },
  fillsOrderTpOrSl: {},
};

const perpsAtom = atom(initialState);

const wsSubscriptionsAtom = atom<(() => void)[]>([]);

export const usePerpsStore = () => {
  const [state, setState] = useAtom(perpsAtom);
  const appState = useAppState();

  const [wsSubscriptions, setWsSubscriptions] = useAtom(wsSubscriptionsAtom);

  const setFillsOrderTpOrSl = useMemoizedFn(
    (payload: Record<string, 'tp' | 'sl'>) => {
      setState(prev => ({ ...prev, fillsOrderTpOrSl: payload }));
    },
  );

  const setHomePositionPnl = useMemoizedFn(
    (payload: {
      pnl: number;
      show: boolean;
      type: 'pnl' | 'accountValue';
      accountValue: number;
    }) => {
      setState(prev => ({ ...prev, homePositionPnl: payload }));
    },
  );

  const setHasPermission = useMemoizedFn((payload: boolean) => {
    setState(prev => ({ ...prev, hasPermission: payload }));
  });

  // Reducers 转换为 setState 操作
  const setLocalLoadingHistory = useMemoizedFn(
    (payload: AccountHistoryItem[], isReset: boolean = false) => {
      setState(prev => ({
        ...prev,
        localLoadingHistory: isReset
          ? payload
          : [...payload, ...prev.localLoadingHistory],
      }));
    },
  );

  const setUserAccountHistory = useMemoizedFn(
    (payload: AccountHistoryItem[]) => {
      setState(prev => ({ ...prev, userAccountHistory: payload }));
    },
  );

  const setUserFills = useMemoizedFn((payload: WsFill[]) => {
    setState(prev => ({ ...prev, userFills: payload }));
  });

  const addUserFills = useMemoizedFn(
    (payload: { fills: WsFill[]; isSnapshot?: boolean; user: string }) => {
      const { fills, isSnapshot } = payload;
      setState(prev => ({
        ...prev,
        userFills: isSnapshot
          ? fills.slice(0, 2000)
          : [...fills, ...prev.userFills],
      }));
    },
  );

  const updatePositionsWithClearinghouse = useMemoizedFn(
    (payload: ClearinghouseState) => {
      setState(prev => {
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
          positionAndOpenOrders,
          homePositionPnl: {
            pnl: payload.assetPositions.reduce((acc, asset) => {
              return acc + Number(asset.position.unrealizedPnl);
            }, 0),
            show: Number(payload.marginSummary.accountValue) > 0,
            type: payload.assetPositions.length > 0 ? 'pnl' : 'accountValue',
            accountValue: Number(payload.marginSummary.accountValue),
          },
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
      setState(prev => {
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
    setState(prev => ({ ...prev, perpFee: payload }));
  });

  const setMarketData = useMemoizedFn((payload: MarketData[] | []) => {
    const list = payload || [];
    setState(prev => ({
      ...prev,
      marketData: list,
      marketDataMap: buildMarketDataMap(list as MarketData[]),
    }));
  });

  const updateMarketData = useMemoizedFn((payload: AssetCtx[]) => {
    setState(prev => {
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
  });

  const setPositionAndOpenOrders = useMemoizedFn(
    (clearinghouseState: ClearinghouseState, openOrders: OpenOrder[]) => {
      setState(prev => ({
        ...prev,
        accountSummary: {
          ...clearinghouseState.marginSummary,
          withdrawable: clearinghouseState.withdrawable,
        },
        positionAndOpenOrders: clearinghouseState.assetPositions.map(
          position => ({
            ...position,
            openOrders: openOrders.filter(
              order => order.coin === position.position.coin,
            ),
          }),
        ),
        homePositionPnl: {
          pnl: clearinghouseState.assetPositions.reduce((acc, order) => {
            return acc + Number(order.position.unrealizedPnl);
          }, 0),
          show: Number(clearinghouseState.marginSummary.accountValue) > 0,
          type:
            clearinghouseState.assetPositions.length > 0
              ? 'pnl'
              : 'accountValue',
          accountValue: Number(clearinghouseState.marginSummary.accountValue),
        },
      }));
    },
  );

  const updateOpenOrders = useMemoizedFn((payload: OpenOrder[]) => {
    setState(prev => {
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
    setState(prev => ({ ...prev, accountSummary: payload }));
  });

  const setCurrentPerpsAccount = useMemoizedFn((payload: Account | null) => {
    setState(prev => ({
      ...prev,
      currentPerpsAccount: payload,
      isLogin: !!payload,
    }));
  });

  const setInitialized = useMemoizedFn((payload: boolean) => {
    setState(prev => ({ ...prev, isInitialized: payload }));
  });

  const setCurrentOnlyShowPerpsAccount = useMemoizedFn(
    (payload: Account | null) => {
      setState(prev => ({ ...prev, currentOnlyShowPerpsAccount: payload }));
    },
  );

  const setApproveSignatures = useMemoizedFn((payload: ApproveSignatures) => {
    setState(prev => ({ ...prev, approveSignatures: payload }));
  });

  const resetState = useMemoizedFn(() => {
    setState(prev => ({
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
    }));
  });

  // Effects 转换为异步函数
  const saveApproveSignatures = useMemoizedFn(
    async (payload: {
      approveSignatures: ApproveSignatures;
      address: string;
    }) => {
      setApproveSignatures(payload.approveSignatures);
      apisPerps.setSendApproveAfterDeposit(
        payload.address,
        payload.approveSignatures,
      );
    },
  );

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
    } catch (error: any) {
      console.error('Failed to fetch clearinghouse state:', error);
    }
  });

  const fetchPerpPermission = useMemoizedFn(async (address: string) => {
    const { has_permission } = await openapi.getPerpPermission({ id: address });

    setHasPermission(has_permission);
    // setHasPermission(true);
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

  const fetchMarketData = useMemoizedFn(async (canUseCache = true) => {
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

  const subscribeToUserData = useMemoizedFn((address: string) => {
    const sdk = apisPerps.getPerpsSDK();

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
        if (appState !== 'active') {
          return;
        }

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
  });

  const unsubscribeAll = useMemoizedFn(() => {
    wsSubscriptions.forEach(unsubscribe => {
      unsubscribe();
    });
    setWsSubscriptions([]);
  });

  const logout = useMemoizedFn(() => {
    unsubscribeAll();
    resetState();
    fetchPerpPermission('');
  });

  const initEventBus = useMemoizedFn(() => {
    eventBus.on(EVENTS.PERPS.LOG_OUT, logout);
  });

  const prevAppStateRef = useRef(appState);

  useEffect(() => {
    if (prevAppStateRef.current !== appState) {
      if (appState !== 'active') {
        unsubscribeAll();
        const sdk = apisPerps.getPerpsSDK();
        sdk.ws.disconnect();
      } else if (
        appState === 'active' &&
        state.isLogin &&
        state.currentPerpsAccount &&
        wsSubscriptions.length === 0
      ) {
        subscribeToUserData(state.currentPerpsAccount.address);
      }
      prevAppStateRef.current = appState;
    }
  }, [
    appState,
    unsubscribeAll,
    subscribeToUserData,
    state.isLogin,
    state.currentPerpsAccount,
    wsSubscriptions.length,
  ]);

  return {
    // State
    state,
    setState,

    // Reducers
    setFillsOrderTpOrSl,
    setHomePositionPnl,
    setHasPermission,
    setLocalLoadingHistory,
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
    setInitialized,
    setApproveSignatures,
    resetState,

    // Effects
    saveApproveSignatures,
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
    subscribeToUserData,
    unsubscribeAll,
    logout,
    initEventBus,
    setCurrentOnlyShowPerpsAccount,
  };
};
