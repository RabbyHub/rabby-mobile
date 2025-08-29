import { useState, useEffect, useRef } from 'react';
import { useMemoizedFn } from 'ahooks';
import {
  AssetPosition,
  ClearinghouseState,
  MarginSummary,
  OpenOrder,
  WsFill,
} from '@rabby-wallet/hyperliquid-sdk';
// import { ApproveSignatures } from '@/background/service/perps';
import { atom, useAtom } from 'jotai';
import { Account } from '@/core/services/preference';
import { ApproveSignatures } from '@/core/services/perpsService';
import { DEFAULT_TOP_ASSET } from '@/constant/perps';
import { apisPerps } from '@/core/apis';
import { formatMarkData } from '@/utils/perps';

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
  type: 'deposit' | 'withdraw';
  status: 'pending' | 'success' | 'failed';
  usdValue: string;
}

export interface PerpsState {
  positionAndOpenOrders: PositionAndOpenOrder[];
  accountSummary: AccountSummary | null;
  currentPerpsAccount: Account | null;
  marketData: MarketData[];
  marketDataMap: MarketDataMap;
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
  currentPerpsAccount: null,
  marketData: [],
  marketDataMap: {},
  perpFee: 0.00045,
  isLogin: false,
  isInitialized: false,
  approveSignatures: [],
  userFills: [],
  userAccountHistory: [],
  localLoadingHistory: [],
  wsSubscriptions: [],
  pollingTimer: null,
  homePositionPnl: {
    pnl: 0,
    show: false,
  },
  fillsOrderTpOrSl: {},
};

const perpsAtom = atom(initialState);

export const usePerpsStore = () => {
  const [state, setState] = useAtom(perpsAtom);

  const wsSubscriptions = useRef<(() => void)[]>([]);
  const pollingTimer = useRef<NodeJS.Timeout | null>(null);

  const setFillsOrderTpOrSl = useMemoizedFn(
    (payload: Record<string, 'tp' | 'sl'>) => {
      setState(prev => ({ ...prev, fillsOrderTpOrSl: payload }));
    },
  );

  const setHomePositionPnl = useMemoizedFn(
    (payload: { pnl: number; show: boolean }) => {
      setState(prev => ({ ...prev, homePositionPnl: payload }));
    },
  );

  const setHasPermission = useMemoizedFn((state, payload: boolean) => {
    setState(prev => ({ ...prev, hasPermission: payload }));
  });

  // Reducers 转换为 setState 操作
  const setLocalLoadingHistory = useMemoizedFn(
    (payload: AccountHistoryItem[]) => {
      setState(prev => ({ ...prev, localLoadingHistory: payload }));
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

        const positionAndOpenOrders = payload.assetPositions
          .filter(position => position.position.leverage.type === 'isolated')
          .map(position => ({
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
        };
      });
    },
  );

  const updateUserAccountHistory = useMemoizedFn(
    (payload: { newHistoryList: AccountHistoryItem[] }) => {
      const { newHistoryList } = payload;
      setState(prev => {
        const filteredLocalHistory = prev.localLoadingHistory.filter(
          item => !newHistoryList.some(l => l.hash === item.hash),
        );
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

  const setPositionAndOpenOrders = useMemoizedFn(
    (payload: PositionAndOpenOrder[] | []) => {
      setState(prev => ({ ...prev, positionAndOpenOrders: payload }));
    },
  );

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

  const setApproveSignatures = useMemoizedFn((payload: ApproveSignatures) => {
    setState(prev => ({ ...prev, approveSignatures: payload }));
  });

  const resetState = useMemoizedFn(() => {
    setState({
      positionAndOpenOrders: [],
      accountSummary: null,
      currentPerpsAccount: null,
      marketData: [],
      marketDataMap: {},
      perpFee: 0.00045,
      isLogin: false,
      isInitialized: false,
      approveSignatures: [],
      userFills: [],
      userAccountHistory: [],
      localLoadingHistory: [],
      wsSubscriptions: [],
      pollingTimer: null,
      homePositionPnl: {
        pnl: 0,
        show: false,
      },
      fillsOrderTpOrSl: {},
    });
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

  const fetchPositionAndOpenOrders = useMemoizedFn(async () => {
    const sdk = apisPerps.getPerpsSDK();
    try {
      const [clearinghouseState, openOrders] = await Promise.all([
        sdk.info.getClearingHouseState(),
        sdk.info.getFrontendOpenOrders(),
      ]);

      const positionAndOpenOrders = clearinghouseState.assetPositions
        .filter(position => position.position.leverage.type === 'isolated')
        .map(position => ({
          ...position,
          openOrders: openOrders.filter(
            order => order.coin === position.position.coin,
          ),
        }));

      setPositionAndOpenOrders(positionAndOpenOrders);
      setAccountSummary({
        ...clearinghouseState.marginSummary,
        withdrawable: clearinghouseState.withdrawable,
      });
    } catch (error: any) {
      console.error('Failed to fetch clearinghouse state:', error);
    }
  });

  const loginPerpsAccount = useMemoizedFn(async (account: Account) => {
    apisPerps.setPerpsCurrentAccount(account);
    setCurrentPerpsAccount(account);
    await refreshData();
    subscribeToUserData(account.address);
    startPolling();
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

  const fetchUserNonFundingLedgerUpdates = useMemoizedFn(async () => {
    const sdk = apisPerps.getPerpsSDK();
    try {
      const res = await sdk.info.getUserNonFundingLedgerUpdates();

      const list = res
        .filter(item => {
          if (
            item.delta.type === 'deposit' ||
            item.delta.type === 'withdraw' ||
            item.delta.type === 'accountClassTransfer'
          ) {
            return true;
          }
          return false;
        })
        .map(item => {
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
      console.log('fetchUserNonFundingLedgerUpdates', list);
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
    await fetchUserNonFundingLedgerUpdates();
    await fetchUserHistoricalOrders();
  });

  const fetchMarketData = useMemoizedFn(async () => {
    const sdk = apisPerps.getPerpsSDK();
    try {
      const marketData = await sdk.info.metaAndAssetCtxs(true);
      setMarketData(formatMarkData(marketData, DEFAULT_TOP_ASSET));
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

    const { unsubscribe: unsubscribeFills } = sdk.ws.subscribeToUserFills(
      data => {
        console.log('User fills update:', data);
        const { fills, isSnapshot, user } = data;
        if (user !== address) {
          return;
        }

        addUserFills({
          fills,
          isSnapshot: isSnapshot || false,
          user,
        });
      },
    );

    wsSubscriptions.current.push(unsubscribeFills);
  });

  const startPolling = useMemoizedFn(() => {
    stopPolling();
    pollingTimer.current = setInterval(() => {
      fetchClearinghouseState();
    }, 5000);
    console.log('开始轮询ClearingHouseState, 间隔5秒');
  });

  const stopPolling = useMemoizedFn(() => {
    if (pollingTimer.current) {
      clearInterval(pollingTimer.current);
      pollingTimer.current = null;
      console.log('停止轮询ClearingHouseState');
    }
  });

  const unsubscribeAll = useMemoizedFn(() => {
    wsSubscriptions.current.forEach(unsubscribe => {
      unsubscribe();
    });
    wsSubscriptions.current = [];
  });

  const logout = useMemoizedFn(() => {
    stopPolling();
    unsubscribeAll();
    resetState();
  });

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
    setAccountSummary,
    setCurrentPerpsAccount,
    setInitialized,
    setApproveSignatures,
    resetState,

    // Effects
    saveApproveSignatures,
    fetchPositionAndOpenOrders,
    loginPerpsAccount,
    fetchClearinghouseState,
    fetchUserNonFundingLedgerUpdates,
    refreshData,
    fetchMarketData,
    fetchPerpFee,
    subscribeToUserData,
    startPolling,
    stopPolling,
    unsubscribeAll,
    logout,
  };
};
