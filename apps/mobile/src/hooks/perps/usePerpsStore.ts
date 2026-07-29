import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useMemoizedFn } from 'ahooks';
import type {
  AssetCtx,
  AssetPosition,
  ClearinghouseState,
  MarginSummary,
  OpenOrder,
  PerpDexsResponse,
  UserNonFundingLedgerUpdates,
  WsFastAssetCtxs,
  WsFill,
} from '@rabby-wallet/hyperliquid-sdk';
import { UserAbstractionResp } from '@rabby-wallet/hyperliquid-sdk';
// import { ApproveSignatures } from '@/background/service/perps';
import type { Account } from '@/core/startupServices/preference';
import type {
  ApproveSignatures,
  PerpsMarketDataCache,
} from '@/core/services/perpsService';
import {
  DEFAULT_TOP_ASSET,
  DEFAULT_TOKEN_CATEGORY,
  HYPE_EVM_BRIDGE_ADDRESS_MAP,
  HYPE_CORE_DEPOSIT_WALLET,
} from '@/constant/perps';
import { apisPerps } from '@/core/apis/perps';
import {
  formatAllDexsClearinghouseState,
  formatMarkData,
  formatPositionPnl,
  formatSpotState,
  getPxDecimals,
} from '@/utils/perps';
import { eventBus, EVENTS } from '@/utils/events';
import { openapi } from '@/core/request';
import { unionBy } from 'lodash';
import { zCreate } from '@/core/utils/reexports';
import type { UpdaterOrPartials } from '@/core/utils/store';
import { resolveValFromUpdater } from '@/core/utils/store';
import { STARTUP_TASKS } from '@/core/utils/startupTaskManifest';
import {
  runStartupTask,
  scheduleStartupTask,
} from '@/core/utils/startupScheduler';
import { AppState } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { perpsServiceApi } from '@/core/serviceApi/perps';
import type {
  PerpTopTokenV3,
  PerpTopTokenCategory,
} from '@rabby-wallet/rabby-api/dist/types';
import { stats } from '@/utils/stats';
import BigNumber from 'bignumber.js';
import { mergeUserFills, reconcileHttpFills } from './userFills';
import { traceStartupDiagnostic } from '@/core/utils/startupDiagnostics';

let perpsTopTokenCache: PerpTopTokenV3[] = [];
let perpsCategoryCache: PerpTopTokenCategory[] = [];

// Meta-only marketData snapshot: ticker fields are blanked (stale prices must
// never render as current). Bump the version on MarketData shape changes.
const MARKET_DATA_CACHE_VERSION = 1;
const MARKET_DATA_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const EMPTY_MARKET_TICKER = {
  dayBaseVlm: '0',
  dayNtlVlm: '0',
  funding: '0',
  markPx: '',
  midPx: '',
  openInterest: '0',
  oraclePx: '',
  premium: '0',
  prevDayPx: '',
} satisfies Partial<MarketData>;

// A blanket `{ ...item, ...EMPTY_MARKET_TICKER }` would persist undeclared
// extras riding along from `applyAssetCtxsToList`'s ctx spread (e.g.
// `impactPxs`, a live price pair) — stale prices must never hit the disk.
const toCachedMarketData = (item: MarketData): MarketData => ({
  index: item.index,
  logoUrl: item.logoUrl,
  name: item.name,
  displayName: item.displayName,
  quoteAsset: item.quoteAsset,
  maxLeverage: item.maxLeverage,
  minLeverage: item.minLeverage,
  maxUsdValueSize: item.maxUsdValueSize,
  szDecimals: item.szDecimals,
  pxDecimals: item.pxDecimals,
  onlyIsolated: item.onlyIsolated,
  dexId: item.dexId,
  category: item.category,
  categoryId: item.categoryId,
  brief: item.brief,
  description: item.description,
  ...EMPTY_MARKET_TICKER,
});

// Per-dex raw snapshots, source of truth for rebuilding the aggregated
// `currentClearinghouseState`. Stale frames (older `time`) never win.
// Key '' === hyper native dex.
const dexClearinghouseStatesCache = new Map<string, ClearinghouseState>();

// Per-dex openOrders. openOrders has no server-side time, so HTTP simply
// overwrites the matching bucket; WS pushes overwrite all buckets.
const dexOpenOrdersCache = new Map<string, OpenOrder[]>();

// HIP-3 dex roster, populated lazily by fetchMarketData.
let perpDexsCache: PerpDexsResponse | null = null;

// Falls back to hyper ('') when marketDataMap hasn't loaded yet.
export const getDexByCoin = (coin: string): string =>
  perpsStore.getState().marketDataMap[coin]?.dexId ?? '';

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
  displayName: string;
  quoteAsset: 'USDC' | 'USDT' | 'USDH' | 'USDE'; // derived from Meta.collateralToken
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
  category?: string;
  categoryId?: string;
  brief?: string;
  description?: string;
}

export type MarketDataMap = Record<string, MarketData>;

export interface AccountHistoryItem {
  time: number;
  hash: string;
  destinationDex?: string;
  type: 'deposit' | 'withdraw' | 'receive' | 'transfer';
  status: 'pending' | 'success' | 'failed';
  usdValue: string;
}

export type AllDexsClearinghouseState = [string, ClearinghouseState][];

export interface SpotBalance {
  coin: string;
  token: number;
  total: string;
  hold: string;
  available: string;
}

export type MarketDataStatus = 'idle' | 'loading' | 'success' | 'error';

export interface PerpsState {
  // positionAndOpenOrders: PositionAndOpenOrder[];
  currentClearinghouseState: ClearinghouseState | null;
  spotState: {
    accountValue: string;
    availableToTrade: string;
    balances: SpotBalance[];
    balancesMap: Record<string, SpotBalance>;
    tokenToAvailableAfterMaintenance: [number, string][] | null;
  };
  userAbstraction: UserAbstractionResp;
  userAbstractionReady: boolean;
  openOrders: OpenOrder[];
  currentPerpsAccount: Account | null;
  clearinghouseStateMap: Record<string, ClearinghouseState | null>;
  isFetchAllDone: boolean; // init ClearinghouseStateMap has done
  accountNeedApproveAgent: boolean; // 账户是否需要重新approve agent
  accountNeedApproveBuilderFee: boolean; // 账户是否需要重新approve builder fee
  marketData: MarketData[];
  marketDataMap: MarketDataMap;
  marketDataStatus: MarketDataStatus;
  categories: PerpTopTokenCategory[];
  hasPermission: boolean;
  perpFee: number;
  isLogin: boolean;
  isInitialized: boolean;
  // First WS snapshot received for the current account's clearinghouse state.
  isUserDataReady: boolean;
  // First WS snapshot received for the current account's spot state.
  isSpotStateReady: boolean;
  // First WS push received for global asset ticker (AllDexsAssetCtxs).
  isMarketTickerReady: boolean;
  approveSignatures: ApproveSignatures;
  userFills: WsFill[];
  userAccountHistory: AccountHistoryItem[];
  localLoadingHistory: AccountHistoryItem[];
  wsSubscriptions: (() => void)[];
  pollingTimer: NodeJS.Timeout | null;
  fillsOrderTpOrSl: Record<string, 'tp' | 'sl'>;
  favoriteMarkets: string[];
  marginModeByCoin: Record<string, 'cross' | 'isolated'>;
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
    balances: [],
    balancesMap: {},
    tokenToAvailableAfterMaintenance: null,
  },
  userAbstraction: UserAbstractionResp.default,
  userAbstractionReady: false,
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
  marketDataStatus: 'idle',
  isLogin: false,
  isInitialized: false,
  isUserDataReady: false,
  isSpotStateReady: false,
  isMarketTickerReady: false,
  userFills: [],
  approveSignatures: [],
  wsSubscriptions: [],
  pollingTimer: null,
  favoriteMarkets: [],
  marginModeByCoin: {},
  homePositionPnl: {
    pnl: 0,
    accountValue: 0,
    show: false,
    type: 'pnl',
  },
  fillsOrderTpOrSl: {},
  categories: DEFAULT_TOKEN_CATEGORY,
};

const isSamePerpsAccountIdentity = (
  prev: Account | null,
  next: Account | null,
): boolean => {
  if (!prev || !next) {
    return prev === next;
  }
  return isSameAddress(prev.address, next.address) && prev.type === next.type;
};

export const perpsStore = zCreate<PerpsState>(() => ({ ...initialState }));

export type PerpsAccountRuntimeContext = Readonly<{
  account: Account | null;
  generation: number;
  isInitialized: boolean;
}>;

let perpsAccountRuntimeGeneration = 0;

// Zustand listeners run synchronously with setState. This epoch therefore
// changes before a stale Runtime promise can resume in the microtask queue,
// including during the Store -> React effect gap on account switch/logout.
perpsStore.subscribe((state, previousState) => {
  if (
    !isSamePerpsAccountIdentity(
      previousState.currentPerpsAccount,
      state.currentPerpsAccount,
    )
  ) {
    perpsAccountRuntimeGeneration += 1;
  }
});

export const getPerpsAccountRuntimeContext = (): PerpsAccountRuntimeContext => {
  const state = perpsStore.getState();
  return {
    account: state.currentPerpsAccount,
    generation: perpsAccountRuntimeGeneration,
    isInitialized: state.isInitialized,
  };
};

type ActiveUserDataSubscription = {
  address: string;
};

let activeUserDataSubscription: ActiveUserDataSubscription | null = null;
let homeSpotSubscription: {
  address: string;
  unsubscribe: () => void;
} | null = null;
let marketSnapshotUnsubscribe: (() => void) | null = null;
let fastMarketUnsubscribe: (() => void) | null = null;

const canReuseUserDataSubscription = (address: string) =>
  !!activeUserDataSubscription &&
  isSameAddress(activeUserDataSubscription.address, address);

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

function stopHomeSpotSubscription() {
  if (!homeSpotSubscription) {
    return;
  }
  try {
    homeSpotSubscription.unsubscribe();
  } catch (error) {
    console.error('[perpsHomeSpot] unsubscribe failed', error);
  }
  homeSpotSubscription = null;
}

function stopAccountSubscriptions() {
  activeUserDataSubscription = null;
  stopHomeSpotSubscription();
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

// Wait until both WS first frames have arrived (user clearinghouseState + global asset ticker).
// Falls through on timeout so init never hangs forever (e.g. brand-new account, flaky WS).
export const waitForInitialWsData = (timeoutMs = 5000): Promise<void> => {
  return new Promise(resolve => {
    const isReady = (s: PerpsState) =>
      s.isUserDataReady && s.isMarketTickerReady;
    if (isReady(perpsStore.getState())) {
      resolve();
      return;
    }
    let done = false;
    const finish = () => {
      if (done) {
        return;
      }
      done = true;
      unsubscribe();
      clearTimeout(timer);
      resolve();
    };
    const unsubscribe = perpsStore.subscribe(state => {
      if (isReady(state)) {
        finish();
      }
    });
    const timer = setTimeout(finish, timeoutMs);
  });
};

const setHasPermission = (payload: boolean) => {
  setPerpsState(prev => ({ ...prev, hasPermission: payload }));
};

const fetchPerpPermission = async (address: string) => {
  const { has_permission } = await openapi.getPerpPermission({ id: address });

  setHasPermission(has_permission);
  // setHasPermission(true);
};

export const fetchUserAbstraction = async (address: string) => {
  const sdk = apisPerps.getPerpsSDK();
  const userAbstraction = await sdk.info.getUserAbstraction(address);
  const currentAddress = perpsStore.getState().currentPerpsAccount?.address;
  if (!currentAddress || !isSameAddress(currentAddress, address)) {
    return null;
  }
  setPerpsState(prev => ({
    ...prev,
    userAbstraction: userAbstraction,
    userAbstractionReady: true,
  }));
  return userAbstraction;
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

  if (!data) {
    return;
  }

  setPerpsState(prev => {
    const previous = prev.clearinghouseStateMap[address];
    if (previous && (data.time ?? 0) <= (previous.time ?? 0)) {
      return prev;
    }
    const isCurrentAccount =
      !!prev.currentPerpsAccount?.address &&
      isSameAddress(prev.currentPerpsAccount.address, payload.address);
    const shouldUpdateCurrentAccount =
      isCurrentAccount &&
      (!prev.currentClearinghouseState ||
        (data.time ?? 0) >= (prev.currentClearinghouseState.time ?? 0));
    return {
      ...prev,
      clearinghouseStateMap: { ...prev.clearinghouseStateMap, [address]: data },
      ...(shouldUpdateCurrentAccount
        ? {
            currentClearinghouseState: data,
            homePositionPnl: formatPositionPnl(data),
            isUserDataReady: true,
          }
        : {}),
    };
  });
};

export const getClearinghouseStateByMap = (address: string) => {
  return perpsStore.getState().clearinghouseStateMap[address.toLowerCase()];
};

const isSamePerpsAccount = (prev: Account | null, next: Account): boolean =>
  isSamePerpsAccountIdentity(prev, next);

const setCurrentPerpsAccount = (payload: Account) => {
  setPerpsState(prev => {
    const sameAccount = isSamePerpsAccount(prev.currentPerpsAccount, payload);
    return {
      ...prev,
      currentPerpsAccount: payload,
      isLogin: !!payload,
      isUserDataReady: sameAccount ? prev.isUserDataReady : false,
      isSpotStateReady: sameAccount ? prev.isSpotStateReady : false,
      userAbstractionReady: sameAccount ? prev.userAbstractionReady : false,
      // Fills are merged (not overwritten) on WS snapshots, so a stale
      // account's list must be cleared explicitly on switch.
      userFills: sameAccount ? prev.userFills : [],
    };
  });
  void perpsServiceApi.setCurrentAccount(payload).catch(error => {
    console.error('[perpsService] persist current account failed', error);
  });
};

export const switchPerpsAccountBeforeNavigate = (payload: Account) => {
  const clearinghouseState =
    perpsStore.getState().clearinghouseStateMap[payload.address.toLowerCase()];
  const pnl = clearinghouseState
    ? formatPositionPnl(clearinghouseState)
    : initialState.homePositionPnl;
  // Otherwise the next HTTP refresh rebuilds the aggregate with the
  // previous account's sub-dex data still in the cache.
  dexClearinghouseStatesCache.clear();
  dexOpenOrdersCache.clear();
  // Tear down only the old account's streams. Global market feeds have their
  // own lifecycle and remain warm while the Perps screen initializes.
  stopAccountSubscriptions();
  setPerpsState(prev => ({
    ...prev,
    currentPerpsAccount: payload,
    isLogin: !!payload,
    isInitialized: false,
    isUserDataReady: false,
    isSpotStateReady: false,
    userAbstractionReady: false,
    currentClearinghouseState: null,
    homePositionPnl: pnl,
    accountNeedApproveAgent: false,
    accountNeedApproveBuilderFee: false,
    userFills: isSamePerpsAccount(prev.currentPerpsAccount, payload)
      ? prev.userFills
      : [],
  }));
  void perpsServiceApi.setCurrentAccount(payload).catch(error => {
    console.error('[perpsService] persist current account failed', error);
  });
};

// Cache of the latest WS-pushed asset ctxs keyed by dex name.
// WS pushes are full-dex snapshots, so we always keep the latest one.
// Used to backfill ticker fields (markPx / midPx / funding ...) whenever
// fetchMarketData writes a fresh meta list — otherwise ticker updates
// pushed during the fetch window would be lost.
let lastCtxsByDex: Record<string, AssetCtx[]> | null = null;

const applyAssetCtxsToList = (
  list: MarketData[],
  ctxsByDex: Record<string, AssetCtx[]>,
): MarketData[] => {
  return list.map(item => {
    const dexName = item.dexId ? item.dexId : 'hyperliquid';
    const ctx = ctxsByDex[dexName]?.[item.index];
    if (!ctx) {
      return item;
    }
    return {
      ...item,
      ...ctx,
      // Tick precision follows the price magnitude (5-sig-figs rule).
      pxDecimals: getPxDecimals(item.szDecimals, ctx.markPx ?? item.markPx),
    };
  });
};

const setMarketData = (
  payload: MarketData[] | [],
  categories: PerpTopTokenCategory[],
) => {
  const base = payload || [];
  // Merge any WS ticker data that arrived during the fetch window.
  const list = lastCtxsByDex ? applyAssetCtxsToList(base, lastCtxsByDex) : base;
  setPerpsState(prev => ({
    ...prev,
    categories,
    marketData: list,
    marketDataMap: buildMarketDataMap(list),
  }));
};

const setMarketDataStatus = (status: MarketDataStatus) => {
  setPerpsState(prev =>
    prev.marketDataStatus === status
      ? prev
      : { ...prev, marketDataStatus: status },
  );
};

// Retry with exponential backoff. Returns undefined if all attempts fail.
async function withRetry<T>(
  fn: () => Promise<T>,
  options: { retries?: number; baseMs?: number; label?: string } = {},
): Promise<T | undefined> {
  const { retries = 2, baseMs = 500, label = 'task' } = options;
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        const delay = baseMs * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  console.error(`[fetchMarketData] ${label} failed after retries:`, lastError);
  return undefined;
}

// Single-flight: concurrent callers await the same in-flight fetch, so an
// awaited fetchMarketData() resolves only when data is loaded.
let marketDataPromise: Promise<void> | null = null;

// The boot-time fetch races network/VPN readiness and can fail before any
// screen is around to retry it. Reschedule from the store itself: first retry
// fires immediately (the failed round is already over), then capped backoff.
let marketDataRetryTimer: ReturnType<typeof setTimeout> | null = null;
let marketDataRetryCount = 0;

const clearMarketDataRetry = () => {
  if (marketDataRetryTimer) {
    clearTimeout(marketDataRetryTimer);
    marketDataRetryTimer = null;
  }
};

const scheduleMarketDataRetry = () => {
  if (marketDataRetryTimer) {
    return;
  }
  const delay =
    marketDataRetryCount === 0
      ? 0
      : Math.min(30_000, 1_000 * 2 ** marketDataRetryCount);
  marketDataRetryTimer = setTimeout(() => {
    marketDataRetryTimer = null;
    marketDataRetryCount += 1;
    // Don't burn requests in background — reschedule so the chain survives
    // an early-boot 'unknown' state; on resume the AppState 'active'
    // listener refetches anyway (deduped by single-flight).
    if (AppState.currentState === 'active') {
      fetchMarketData();
    } else {
      scheduleMarketDataRetry();
    }
  }, delay);
};

// These openapi endpoints have no axios timeout — a stalled connection would
// hang fetchMarketData forever. Cap them and fall back to defaults on timeout.
const MARKET_DATA_FETCH_TIMEOUT = 10000;

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`[fetchMarketData] ${label} timed out after ${ms}ms`));
    }, ms);
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

const runFetchMarketData = async () => {
  const startedAt = Date.now();
  traceStartupDiagnostic('perps', 'market_fetch_start', {
    cachedCount: perpsStore.getState().marketData.length,
  });
  const prevStatus = perpsStore.getState().marketDataStatus;
  // Only show loading if we don't already have data; avoid UI flicker on silent refresh.
  if (prevStatus !== 'success') {
    setMarketDataStatus('loading');
  }

  const sdk = apisPerps.getPerpsSDK();

  const fetchTopTokenList = async () => {
    if (perpsTopTokenCache.length > 0) {
      return perpsTopTokenCache;
    }
    try {
      const topAssets = await withTimeout(
        openapi.getPerpTopTokenListV3({ dex_id: 'all' }),
        MARKET_DATA_FETCH_TIMEOUT,
        'getPerpTopTokenListV3',
      );
      if (topAssets.length > 0) {
        perpsTopTokenCache = topAssets;
        return topAssets;
      }
    } catch (error) {
      console.error('Failed to fetch top assets:', error);
    }
    return DEFAULT_TOP_ASSET;
  };

  const fetchTokenCategories = async () => {
    if (perpsCategoryCache.length > 0) {
      return perpsCategoryCache;
    }
    try {
      const categories = await withTimeout(
        openapi.getPerpTokenCategories({ lang: 'en-US' }),
        MARKET_DATA_FETCH_TIMEOUT,
        'getPerpTokenCategories',
      );
      if (categories.length > 0) {
        perpsCategoryCache = categories;
        return categories;
      }
    } catch (error) {
      console.error('Failed to fetch token categories:', error);
    }
    return DEFAULT_TOKEN_CATEGORY;
  };

  try {
    // Core data — must succeed (retried). perpDexs is degradable.
    const [topAssets, categories, allMetas, perpDexs] = await Promise.all([
      fetchTopTokenList(),
      fetchTokenCategories(),
      withRetry(() => sdk.info.getPerpsAllMetas(), {
        label: 'getPerpsAllMetas',
      }),
      withRetry(() => sdk.info.getPerpDexs(), { label: 'getPerpDexs' }),
    ]);

    if (!allMetas || allMetas.length === 0) {
      // Core data unavailable — mark error for retry
      setMarketDataStatus('error');
      return;
    }

    // perpDexs failure falls back to the last known roster — an empty
    // dexIdMap would fail the whole round in formatMarkData.
    if (perpDexs) {
      perpDexsCache = perpDexs;
    }
    const effectivePerpDexs = perpDexs ?? perpDexsCache ?? [];
    const dexIdMap: Record<number, string> = {};
    effectivePerpDexs.forEach((dex, idx) => {
      dexIdMap[idx] = dex?.name ?? '';
    });

    const marketData = formatMarkData(allMetas, topAssets, dexIdMap);
    if (marketData.length === 0) {
      setMarketDataStatus('error');
      return;
    }
    setMarketData(marketData, categories);
    setMarketDataStatus('success');
    void perpsServiceApi
      .setMarketDataCache({
        v: MARKET_DATA_CACHE_VERSION,
        updatedAt: Date.now(),
        // Blank the ticker; read from the store (WS-merged) so the cached
        // pxDecimals is the price-informed one.
        list: perpsStore.getState().marketData.map(toCachedMarketData),
      })
      .catch(error => {
        console.error('[perpsService] persist market data cache failed', error);
      });
  } catch (error) {
    console.error('Failed to fetch market data:', error);
    setMarketDataStatus('error');
  } finally {
    const state = perpsStore.getState();
    traceStartupDiagnostic('perps', 'market_fetch_settled', {
      durationMs: Date.now() - startedAt,
      status: state.marketDataStatus,
      marketCount: state.marketData.length,
    });
  }
};

const fetchMarketData = (): Promise<void> => {
  if (marketDataPromise) {
    traceStartupDiagnostic('perps', 'market_fetch_reused');
    return marketDataPromise;
  }
  // Any fetch (boot, AppState resume, Perps screen init, pull-to-refresh)
  // doubles as the pending retry.
  clearMarketDataRetry();
  marketDataPromise = runFetchMarketData().finally(() => {
    marketDataPromise = null;
    if (perpsStore.getState().marketDataStatus === 'success') {
      marketDataRetryCount = 0;
    } else {
      scheduleMarketDataRetry();
    }
  });
  return marketDataPromise;
};

const fetchFavoriteMarkets = async () => {
  const favoriteMarkets = await perpsServiceApi.getFavoriteMarkets();
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
  void perpsServiceApi.addFavoriteMarket(normalizedMarket).catch(error => {
    console.error('[perpsService] persist favorite market failed', error);
  });
};

const fetchMarginModeByCoin = async () => {
  const marginModeByCoin = await perpsServiceApi.getMarginModeByCoin();
  setPerpsState(prev => ({ ...prev, marginModeByCoin }));
};

export const setMarginModeForCoin = (
  coin: string,
  mode: 'cross' | 'isolated',
) => {
  if (!coin) {
    return;
  }
  setPerpsState(prev => {
    if (prev.marginModeByCoin[coin] === mode) {
      return prev;
    }
    return {
      ...prev,
      marginModeByCoin: { ...prev.marginModeByCoin, [coin]: mode },
    };
  });
  void perpsServiceApi.setMarginModeForCoin(coin, mode).catch(error => {
    console.error('[perpsService] persist margin mode failed', error);
  });
};

export const removeFavoriteMarket = (market: string) => {
  const normalizedMarket = market.toUpperCase();
  setPerpsState(prev => ({
    ...prev,
    favoriteMarkets: prev.favoriteMarkets.filter(m => m !== normalizedMarket),
  }));
  void perpsServiceApi.removeFavoriteMarket(normalizedMarket).catch(error => {
    console.error('[perpsService] remove favorite market failed', error);
  });
};

const startHomeSpotSubscription = (address: string) => {
  if (
    canReuseUserDataSubscription(address) ||
    (homeSpotSubscription &&
      isSameAddress(homeSpotSubscription.address, address))
  ) {
    return;
  }

  stopHomeSpotSubscription();
  const sdk = apisPerps.getPerpsSDK();
  const { unsubscribe } = sdk.ws.subscribeToSpotState(data => {
    const { spotState, user } = data;
    const currentAddress = perpsStore.getState().currentPerpsAccount?.address;
    if (
      !currentAddress ||
      !isSameAddress(currentAddress, address) ||
      !isSameAddress(user, address) ||
      !spotState
    ) {
      return;
    }
    setPerpsState(prev => ({
      ...prev,
      spotState: formatSpotState(spotState),
      isSpotStateReady: true,
    }));
  });
  homeSpotSubscription = { address, unsubscribe };
  traceStartupDiagnostic('perps', 'home_spot_subscription_registered');
};

const prepareHomePerpsAccount = async (account: Account) => {
  const reusesFullSubscription = canReuseUserDataSubscription(account.address);
  if (!reusesFullSubscription) {
    stopAccountSubscriptions();
  }

  const cachedClearinghouseState =
    perpsStore.getState().clearinghouseStateMap[
      account.address.toLowerCase()
    ] ?? null;
  setCurrentPerpsAccount(account);
  setPerpsState(prev => ({
    ...prev,
    currentClearinghouseState: cachedClearinghouseState,
    homePositionPnl: cachedClearinghouseState
      ? formatPositionPnl(cachedClearinghouseState)
      : initialState.homePositionPnl,
    isUserDataReady: !!cachedClearinghouseState,
  }));

  const sdk = apisPerps.getPerpsSDK();
  if (!reusesFullSubscription) {
    sdk.initAccount(account.address);
  }
  const userAbstraction = await fetchUserAbstraction(account.address);
  if (
    !userAbstraction ||
    !isSameAddress(
      perpsStore.getState().currentPerpsAccount?.address || '',
      account.address,
    )
  ) {
    return;
  }

  const needsSpotState =
    userAbstraction === UserAbstractionResp.unifiedAccount ||
    userAbstraction === UserAbstractionResp.portfolioMargin;
  if (needsSpotState && !reusesFullSubscription) {
    startHomeSpotSubscription(account.address);
  } else if (!needsSpotState) {
    stopHomeSpotSubscription();
  }
};

const handleSelectDefaultAccount = async (accounts: Account[]) => {
  setInitialized(false);
  try {
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
      void prepareHomePerpsAccount(account).catch(error => {
        console.error('[perpsHomePosition] prepare account failed', error);
      });
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

export const setAccountNeedApproveAgent = (payload: boolean) => {
  setPerpsState(prev => ({ ...prev, accountNeedApproveAgent: payload }));
};

// Module-level no-op placeholders; callers can import without subscribing to state
export const fetchClearinghouseStateAction = async () => {};
export const fetchPositionOpenOrdersAction = async () => {};

export const setAccountNeedApproveBuilderFee = (payload: boolean) => {
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
    isUserDataReady: false,
    isSpotStateReady: false,
    userAbstractionReady: false,
    currentClearinghouseState: null,
  }));
};

const fetchUserFillHistory = async () => {
  const sdk = apisPerps.getPerpsSDK();
  const expectedAddress = perpsStore.getState().currentPerpsAccount?.address;
  try {
    const res = await sdk.info.getUserFills();
    // Account switched during the await — drop the response.
    if (
      perpsStore.getState().currentPerpsAccount?.address !== expectedAddress
    ) {
      return;
    }
    setPerpsState(prev => ({
      ...prev,
      userFills: reconcileHttpFills(res as unknown as WsFill[], prev.userFills),
    }));
  } catch (error) {
    console.error('Failed to fetch user fill history:', error);
  }
};

const addUserFills = (payload: {
  fills: WsFill[];
  isSnapshot?: boolean;
  user: string;
}) => {
  const { fills, isSnapshot } = payload;
  // The subscription callback filters by its own account; also check the
  // store's CURRENT account so a not-yet-unsubscribed old subscription can't
  // pollute the list right after a switch (merge never self-heals).
  const currentAddress = perpsStore.getState().currentPerpsAccount?.address;
  if (!currentAddress || !isSameAddress(payload.user, currentAddress)) {
    return;
  }
  if (isSnapshot) {
    fetchUserFillHistory();
  }

  setPerpsState(prev => ({
    ...prev,
    userFills: mergeUserFills(fills, prev.userFills),
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

      const {
        destination = '',
        usdcValue = '0',
        user = '',
        destinationDex,
      } = item.delta;
      const isWithdrawSend = Object.values(
        HYPE_EVM_BRIDGE_ADDRESS_MAP,
      ).includes(destination);
      if (item.delta.type === 'send' && isWithdrawSend) {
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
        if (user && destination && isSameAddress(user, destination)) {
          return {
            time: item.time,
            hash: item.hash,
            destinationDex,
            type: 'transfer' as const,
            status: 'success' as const,
            usdValue: usdcValue.toString(),
          };
        } else {
          return {
            time: item.time,
            hash: item.hash,
            type: 'receive' as const,
            status: 'success' as const,
            usdValue: usdcValue.toString(),
          };
        }
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
    // Snapshot may be large (historical replay after WS reconnect on app
    // foreground). Avoid O(pending * snapshot) type scan — take the latest
    // ledger time per type and drop any pending of the same type whose time
    // is older, since HL has already recorded an event for it.
    const maxTimeByType: Record<string, number> = {};
    for (const item of newList) {
      const prev = maxTimeByType[item.type];
      if (prev === undefined || item.time > prev) {
        maxTimeByType[item.type] = item.time;
      }
    }
    const filteredLocalHistory = state.localLoadingHistory.filter(p => {
      const cutoff = maxTimeByType[p.type];
      return cutoff === undefined || p.time > cutoff;
    });

    fetchUserNonFundingLedgerUpdates();
    setPerpsState(prev => ({
      ...prev,
      localLoadingHistory: filteredLocalHistory,
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

  // Always cache the latest ticker snapshot — fetchMarketData will merge it in
  // when it writes the next meta list, so pushes during the fetch window are
  // not lost.
  lastCtxsByDex = marketByDexName;

  setPerpsState(prev => {
    if (prev.marketData.length === 0) {
      return prev.isMarketTickerReady
        ? prev
        : { ...prev, isMarketTickerReady: true };
    }
    const newMarketData = applyAssetCtxsToList(
      prev.marketData,
      marketByDexName,
    );
    return {
      ...prev,
      isMarketTickerReady: true,
      marketData: newMarketData,
      marketDataMap: buildMarketDataMap(newMarketData),
    };
  });
};

// Overlay fresh markPx/midPx from fastAssetCtxs onto perp marketData (by coin
// name). This feed supersedes the throttled allDexsAssetCtxs for PRICES only;
// other ctx fields still come from allDexsAssetCtxs. Spot coins in the combined
// feed match no perp name and are ignored (mobile has no spot). Same ref when
// unchanged so the map rebuild + re-render is skipped.
const overlayFastCtxsToMarketData = (
  list: MarketData[],
  fastCtxs: WsFastAssetCtxs,
): MarketData[] => {
  let changed = false;
  const next = list.map(item => {
    const fc = fastCtxs[item.name];
    if (!fc) {
      return item;
    }
    // Delta frames omit unchanged fields, so keep the prior value when absent.
    const markPx = fc.markPx != null ? fc.markPx : item.markPx;
    const midPx = fc.midPx != null ? fc.midPx : item.midPx;
    if (markPx === item.markPx && midPx === item.midPx) {
      return item;
    }
    changed = true;
    return {
      ...item,
      markPx,
      midPx,
      pxDecimals: getPxDecimals(item.szDecimals, markPx ?? item.markPx),
    };
  });
  return changed ? next : list;
};

const updateMarketDataByFastCtxs = (payload: WsFastAssetCtxs) => {
  if (!payload) {
    return;
  }
  setPerpsState(prev => {
    if (prev.marketData.length === 0) {
      return prev;
    }
    const nextMarketData = overlayFastCtxsToMarketData(
      prev.marketData,
      payload,
    );
    if (nextMarketData === prev.marketData) {
      return prev;
    }
    return {
      ...prev,
      marketData: nextMarketData,
      marketDataMap: buildMarketDataMap(nextMarketData),
    };
  });
};

const startMarketSnapshotSubscription = () => {
  if (marketSnapshotUnsubscribe) {
    return false;
  }
  const startedAt = Date.now();
  let receivedFirstFrame = false;
  const sdk = apisPerps.getPerpsSDK();
  const { unsubscribe } = sdk.ws.subscribeToAllDexsAssetCtxs(data => {
    if (!receivedFirstFrame) {
      receivedFirstFrame = true;
      traceStartupDiagnostic('perps', 'market_snapshot_first_frame', {
        durationMs: Date.now() - startedAt,
      });
    }
    updateMarketData(data.ctxs);
  });
  marketSnapshotUnsubscribe = unsubscribe;
  traceStartupDiagnostic('perps', 'market_snapshot_registered');
  return true;
};

const startFastMarketSubscription = () => {
  if (fastMarketUnsubscribe) {
    return false;
  }
  const sdk = apisPerps.getPerpsSDK();
  const { unsubscribe } = sdk.ws.subscribeToFastAssetCtxs(data => {
    updateMarketDataByFastCtxs(data);
  });
  fastMarketUnsubscribe = unsubscribe;
  traceStartupDiagnostic('perps', 'market_fast_registered');
  return true;
};

const startMarketSubscriptions = ({ fast = false } = {}) => {
  startMarketSnapshotSubscription();
  if (fast) {
    startFastMarketSubscription();
  }
};

const stopMarketSubscriptions = () => {
  const subscriptions = [
    marketSnapshotUnsubscribe,
    fastMarketUnsubscribe,
  ].filter((unsubscribe): unsubscribe is () => void => !!unsubscribe);
  marketSnapshotUnsubscribe = null;
  fastMarketUnsubscribe = null;
  subscriptions.forEach(unsubscribe => {
    try {
      unsubscribe();
    } catch (error) {
      console.error('[perpsMarket] unsubscribe failed', error);
    }
  });
  lastCtxsByDex = null;
  setPerpsState(prev =>
    prev.isMarketTickerReady ? { ...prev, isMarketTickerReady: false } : prev,
  );
};

export const subscribeToUserData = (account: Account) => {
  startMarketSubscriptions({ fast: true });
  if (canReuseUserDataSubscription(account.address)) {
    traceStartupDiagnostic('perps', 'user_subscription_reused');
    return false;
  }

  const startedAt = Date.now();
  let receivedUserFrame = false;
  traceStartupDiagnostic('perps', 'user_subscription_start');
  const sdk = apisPerps.getPerpsSDK();
  const address = account.address;
  stopAccountSubscriptions();
  const { unsubscribe: unsubscribeClearinghouseState } =
    sdk.ws.subscribeToAllDexsClearinghouseState(address, data => {
      const { clearinghouseStates, user } = data;
      if (!isSameAddress(user, address)) {
        return;
      }
      if (!receivedUserFrame) {
        receivedUserFrame = true;
        traceStartupDiagnostic('perps', 'user_subscription_first_frame', {
          durationMs: Date.now() - startedAt,
        });
      }
      // Cache is the single source of truth — both WS and HTTP funnel
      // through here, time-guarded per dex. Rebuild + commit aggregate via
      // the shared flush so the React state write also gets the guard.
      for (const [dexName, state] of clearinghouseStates) {
        if (!state) {
          continue;
        }
        const prevDex = dexClearinghouseStatesCache.get(dexName);
        if (prevDex && (state.time ?? 0) <= (prevDex.time ?? 0)) {
          continue;
        }
        dexClearinghouseStatesCache.set(dexName, state);
      }
      flushAggregatedClearinghouseState();
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
        isSpotStateReady: true,
      }));
    },
  );

  const { unsubscribe: unsubscribeOpenOrders } = sdk.ws.subscribeToOpenOrders(
    data => {
      const { orders, user } = data;
      if (!isSameAddress(user, address) || !orders) {
        return;
      }
      // Bucket by dex so a single-dex HTTP refresh can overwrite just its
      // bucket without losing other dexes' orders.
      const marketDataMap = perpsStore.getState().marketDataMap;
      const buckets = new Map<string, OpenOrder[]>();
      for (const order of orders) {
        const dexName = marketDataMap[order.coin]?.dexId ?? '';
        const list = buckets.get(dexName);
        if (list) {
          list.push(order);
        } else {
          buckets.set(dexName, [order]);
        }
      }
      dexOpenOrdersCache.clear();
      for (const [dexName, list] of buckets) {
        dexOpenOrdersCache.set(dexName, list);
      }

      setPerpsState(prev => ({ ...prev, openOrders: orders }));
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
      unsubscribeOpenOrders,
      unsubscribeFills,
      unsubscribeUserNonFundingLedgerUpdates,
    ];
  });
  activeUserDataSubscription = {
    address,
  };
  traceStartupDiagnostic('perps', 'user_subscription_registered', {
    durationMs: Date.now() - startedAt,
  });
  return true;
};

// Returns true when the cache changed; callers batch the setState flush.
const fetchAndCacheClearinghouseForDex = async (
  dex: string,
  expectedAddress: string,
): Promise<boolean> => {
  const sdk = apisPerps.getPerpsSDK();
  let state: ClearinghouseState;
  try {
    state = await sdk.info.getClearingHouseState(
      expectedAddress,
      dex || undefined,
    );
  } catch (e) {
    console.error('[fetchClearinghouseStateHttp] failed', dex, e);
    return false;
  }
  // Account switched during the await — drop the response.
  if (perpsStore.getState().currentPerpsAccount?.address !== expectedAddress) {
    return false;
  }
  const prevDex = dexClearinghouseStatesCache.get(dex);
  if (prevDex && (state.time ?? 0) <= (prevDex.time ?? 0)) {
    return false;
  }
  dexClearinghouseStatesCache.set(dex, state);
  return true;
};

const flushAggregatedClearinghouseState = () => {
  const entries = Array.from(dexClearinghouseStatesCache.entries());
  const aggregated = formatAllDexsClearinghouseState(entries);
  if (!aggregated) {
    return;
  }
  setPerpsState(prev => {
    if (
      prev.currentClearinghouseState &&
      (aggregated.time ?? 0) <= (prev.currentClearinghouseState.time ?? 0)
    ) {
      return prev;
    }
    return {
      ...prev,
      currentClearinghouseState: aggregated,
      homePositionPnl: formatPositionPnl(aggregated),
      isUserDataReady: true,
    };
  });
};

export const fetchClearinghouseStateHttp = async (dex: string) => {
  const account = perpsStore.getState().currentPerpsAccount;
  if (!account?.address) {
    return;
  }
  const touched = await fetchAndCacheClearinghouseForDex(dex, account.address);
  if (touched) {
    flushAggregatedClearinghouseState();
  }
};

const fetchAndCacheOpenOrdersForDex = async (
  dex: string,
  expectedAddress: string,
): Promise<boolean> => {
  const sdk = apisPerps.getPerpsSDK();
  let orders: OpenOrder[];
  try {
    orders = await sdk.info.getFrontendOpenOrders(
      expectedAddress,
      dex || undefined,
    );
  } catch (e) {
    console.error('[fetchPositionOpenOrdersHttp] failed', dex, e);
    return false;
  }
  if (perpsStore.getState().currentPerpsAccount?.address !== expectedAddress) {
    return false;
  }
  dexOpenOrdersCache.set(dex, orders);
  return true;
};

const flushAggregatedOpenOrders = () => {
  const flattened = Array.from(dexOpenOrdersCache.values()).flat();
  setPerpsState(prev => ({ ...prev, openOrders: flattened }));
};

// No server-side time guard for openOrders: callers fire this after the
// SDK has confirmed the mutating action, and WS reconciles any drift quickly.
export const fetchPositionOpenOrdersHttp = async (dex: string) => {
  const account = perpsStore.getState().currentPerpsAccount;
  if (!account?.address) {
    return;
  }
  const touched = await fetchAndCacheOpenOrdersForDex(dex, account.address);
  if (touched) {
    flushAggregatedOpenOrders();
  }
};

// For multi-dex callers (cancel-all on Home): one flush, not N renders.
export const fetchPositionOpenOrdersHttpForDexes = async (dexes: string[]) => {
  const account = perpsStore.getState().currentPerpsAccount;
  if (!account?.address) {
    return;
  }
  const unique = Array.from(new Set(dexes));
  if (unique.length === 0) {
    return;
  }
  const address = account.address;
  const results = await Promise.all(
    unique.map(dex => fetchAndCacheOpenOrdersForDex(dex, address)),
  );
  if (results.some(Boolean)) {
    flushAggregatedOpenOrders();
  }
};

const collectAllDexes = (): string[] => {
  const dexes = (perpDexsCache ?? []).map(d => d?.name ?? '');
  if (dexes.length === 0) {
    dexes.push('');
  }
  return dexes;
};

// One flush, not N renders.
export const fetchAllDexsClearinghouseStateHttp = async () => {
  const account = perpsStore.getState().currentPerpsAccount;
  if (!account?.address) {
    return;
  }
  const address = account.address;
  const results = await Promise.all(
    collectAllDexes().map(dex =>
      fetchAndCacheClearinghouseForDex(dex, address),
    ),
  );
  if (results.some(Boolean)) {
    flushAggregatedClearinghouseState();
  }
};

export const fetchAllDexsPositionOpenOrdersHttp = async () => {
  const account = perpsStore.getState().currentPerpsAccount;
  if (!account?.address) {
    return;
  }
  const address = account.address;
  const results = await Promise.all(
    collectAllDexes().map(dex => fetchAndCacheOpenOrdersForDex(dex, address)),
  );
  if (results.some(Boolean)) {
    flushAggregatedOpenOrders();
  }
};

// Mirrors isMyAccount (core/apis/account); local copy because its parameter
// type rejects the persisted StoreAccount. Keep the excluded types in sync.
const canSubscribePerpsPosition = (type: string) =>
  type !== KEYRING_CLASS.WATCH &&
  type !== KEYRING_CLASS.GNOSIS &&
  type !== KEYRING_CLASS.WALLETCONNECT;

type HomePositionSubscriptionState = {
  key: string;
  fetchedAddresses: Set<string>;
  hasSelectedDefaultAccount: boolean;
  timeout: ReturnType<typeof setTimeout> | null;
  unsubscribe: () => void;
};

let homePositionTopAccounts: Account[] = [];
let homePositionPersistedAddress: string | null = null;
let homePositionExtraAddresses: string[] = [];
let homePositionSubscription: HomePositionSubscriptionState | null = null;
let homePositionSubscriptionGeneration = 0;

const getHomePositionTargetAddresses = () =>
  unionBy(
    [
      ...homePositionTopAccounts.map(account => account.address),
      ...(homePositionPersistedAddress ? [homePositionPersistedAddress] : []),
      ...homePositionExtraAddresses,
    ],
    address => address.toLowerCase(),
  );

const selectDefaultHomePerpsAccount = (
  subscription: HomePositionSubscriptionState,
) => {
  if (
    subscription !== homePositionSubscription ||
    subscription.hasSelectedDefaultAccount ||
    homePositionTopAccounts.length === 0
  ) {
    return;
  }
  subscription.hasSelectedDefaultAccount = true;
  handleSelectDefaultAccount(homePositionTopAccounts).catch(error => {
    console.error('[perpsHomePosition] select default account failed', error);
  });
};

const hasFetchedAllHomeAccounts = (
  subscription: HomePositionSubscriptionState,
) =>
  homePositionTopAccounts.every(account =>
    subscription.fetchedAddresses.has(account.address.toLowerCase()),
  );

const settleHomePositionSubscriptionIfReady = (
  subscription: HomePositionSubscriptionState,
) => {
  if (!hasFetchedAllHomeAccounts(subscription)) {
    return;
  }
  setIsFetchAllDone(true);
  if (subscription.timeout) {
    clearTimeout(subscription.timeout);
    subscription.timeout = null;
  }
  selectDefaultHomePerpsAccount(subscription);
};

const reconcileHomePositionSubscription = () => {
  const addresses = getHomePositionTargetAddresses();
  if (addresses.length === 0) {
    return;
  }

  const key = addresses
    .map(address => address.toLowerCase())
    .sort()
    .join(',');
  if (homePositionSubscription?.key === key) {
    settleHomePositionSubscriptionIfReady(homePositionSubscription);
    return;
  }

  const generation = homePositionSubscriptionGeneration;
  if (homePositionSubscription?.timeout) {
    clearTimeout(homePositionSubscription.timeout);
  }
  homePositionSubscription?.unsubscribe();

  const subscription: HomePositionSubscriptionState = {
    key,
    fetchedAddresses: new Set(
      addresses
        .filter(address => getClearinghouseStateByMap(address))
        .map(address => address.toLowerCase()),
    ),
    hasSelectedDefaultAccount: false,
    timeout: null,
    unsubscribe: () => undefined,
  };
  homePositionSubscription = subscription;
  setIsFetchAllDone(false);

  if (homePositionTopAccounts.length > 0) {
    subscription.timeout = setTimeout(() => {
      selectDefaultHomePerpsAccount(subscription);
    }, 5 * 1000);
  }

  const sdk = apisPerps.getPerpsSDK();
  const { unsubscribe } = sdk.ws.subscribeToAllDexsClearinghouseState(
    addresses,
    data => {
      if (
        generation !== homePositionSubscriptionGeneration ||
        subscription !== homePositionSubscription
      ) {
        return;
      }
      subscription.fetchedAddresses.add(data.user.toLowerCase());
      setClearinghouseStateMap({
        address: data.user,
        data: formatAllDexsClearinghouseState(data.clearinghouseStates),
      });
      settleHomePositionSubscriptionIfReady(subscription);
    },
  );
  if (
    generation === homePositionSubscriptionGeneration &&
    subscription === homePositionSubscription
  ) {
    subscription.unsubscribe = unsubscribe;
    settleHomePositionSubscriptionIfReady(subscription);
  } else {
    unsubscribe();
  }
};

const setHomePositionAccounts = (accounts: Account[]) => {
  homePositionTopAccounts = accounts;
  reconcileHomePositionSubscription();
};

const addHomePositionAddresses = (addresses: string[]) => {
  homePositionExtraAddresses = unionBy(
    [...homePositionExtraAddresses, ...addresses],
    address => address.toLowerCase(),
  );
  reconcileHomePositionSubscription();
};

const resetHomePositionSubscription = () => {
  homePositionSubscriptionGeneration += 1;
  if (homePositionSubscription?.timeout) {
    clearTimeout(homePositionSubscription.timeout);
  }
  try {
    homePositionSubscription?.unsubscribe();
  } catch (error) {
    console.error('[perpsHomePosition] unsubscribe failed', error);
  }
  homePositionSubscription = null;
  homePositionTopAccounts = [];
  homePositionPersistedAddress = null;
  homePositionExtraAddresses = [];
  setIsFetchAllDone(false);
};

export const apisPerpsStore = {
  logout: () => {
    stopAccountSubscriptions();
    stopMarketSubscriptions();
    resetHomePositionSubscription();
    resetAccountState();
    // The SDK singleton is torn down on lock (destroyPerpsSDK), so force the
    // init effect to run again on next entry and reinstall the signer
    // (externalSign for self-sign, or the agent vault). Without this, the stale
    // isInitialized=true would skip initIsLogin and a self-sign account could
    // not sign after an unlock.
    setInitialized(false);
    fetchPerpPermission('');
  },
};

export const usePerpsStore = () => {
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
    const canReuseSubscription = canReuseUserDataSubscription(account.address);
    const cachedClearinghouseState =
      perpsStore.getState().clearinghouseStateMap[
        account.address.toLowerCase()
      ] ?? null;
    // Otherwise the first HTTP refresh would rebuild the aggregate with
    // the previous account's sub-dex data still in the cache.
    if (!canReuseSubscription) {
      dexClearinghouseStatesCache.clear();
      dexOpenOrdersCache.clear();
    }
    apisPerps.setPerpsCurrentAccount(account);
    setPerpsState(prev => {
      const sameAccount = isSamePerpsAccount(prev.currentPerpsAccount, account);
      const previousClearinghouseState = sameAccount
        ? prev.currentClearinghouseState
        : null;
      const seededClearinghouseState =
        previousClearinghouseState &&
        (!cachedClearinghouseState ||
          (previousClearinghouseState.time ?? 0) >=
            (cachedClearinghouseState.time ?? 0))
          ? previousClearinghouseState
          : cachedClearinghouseState;
      return {
        ...prev,
        currentPerpsAccount: account,
        isLogin: !!account,
        currentClearinghouseState: seededClearinghouseState,
        homePositionPnl: seededClearinghouseState
          ? formatPositionPnl(seededClearinghouseState)
          : initialState.homePositionPnl,
        isUserDataReady: canReuseSubscription
          ? prev.isUserDataReady
          : !!seededClearinghouseState,
        isSpotStateReady: sameAccount ? prev.isSpotStateReady : false,
        userAbstraction: sameAccount
          ? prev.userAbstraction
          : UserAbstractionResp.default,
        userAbstractionReady: sameAccount ? prev.userAbstractionReady : false,
        localLoadingHistory: [],
        userFills: sameAccount ? prev.userFills : [],
      };
    });
    fetchUserHistoricalOrders();
    if (!canReuseSubscription) {
      subscribeToUserData(account);
    }
    fetchUserNonFundingLedgerUpdates();
    fetchPerpPermission(account.address);
    fetchUserAbstraction(account.address);

    setTimeout(() => {
      fetchPerpFee();
    }, 1000);
    console.log('loginPerpsAccount success', account.address);
  });

  const fetchClearinghouseState = useMemoizedFn((dex: string = '') =>
    fetchClearinghouseStateHttp(dex),
  );

  const fetchPositionOpenOrders = useMemoizedFn((dex: string = '') =>
    fetchPositionOpenOrdersHttp(dex),
  );

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
    // await is login is too low
    fetchMarketData();

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
  };
};

// Hydrate last-known metadata after Home is usable so the Perps route can
// render names, logos, and decimals before its first network refresh lands.
const hydrateMarketDataCache = async () => {
  try {
    const cache =
      (await perpsServiceApi.getMarketDataCache()) as PerpsMarketDataCache<MarketData> | null;
    if (
      !cache ||
      cache.v !== MARKET_DATA_CACHE_VERSION ||
      Date.now() - cache.updatedAt > MARKET_DATA_CACHE_TTL ||
      !Array.isArray(cache.list) ||
      cache.list.length === 0
    ) {
      return;
    }
    setPerpsState(prev => {
      // A fetch already landed — never overwrite fresh data with cache.
      if (prev.marketData.length > 0) {
        return prev;
      }
      const list = lastCtxsByDex
        ? applyAssetCtxsToList(cache.list, lastCtxsByDex)
        : cache.list;
      return {
        ...prev,
        marketData: list,
        marketDataMap: buildMarketDataMap(list),
      };
    });
  } catch (error) {
    console.error('Failed to hydrate market data cache:', error);
  }
};

const fetchMarketDataIfNeeded = () => {
  const { marketData, marketDataStatus } = perpsStore.getState();
  if (marketDataStatus === 'success' && marketData.length > 0) {
    return Promise.resolve();
  }
  return fetchMarketData();
};

const startPersistedPositionSubscription = async () => {
  const startedAt = Date.now();
  const generation = homePositionSubscriptionGeneration;
  traceStartupDiagnostic('perps', 'persisted_position_subscription_start');
  try {
    const [currentAccount, lastUsedAccount] = await Promise.all([
      apisPerps.getPerpsCurrentAccount(),
      apisPerps.getPerpsLastUsedAccount(),
    ]);
    const cached = currentAccount || lastUsedAccount;
    if (
      generation !== homePositionSubscriptionGeneration ||
      !cached?.address ||
      !canSubscribePerpsPosition(cached.type)
    ) {
      traceStartupDiagnostic(
        'perps',
        'persisted_position_subscription_skipped',
        {
          reason:
            generation !== homePositionSubscriptionGeneration
              ? 'stopped'
              : cached?.address
              ? 'unsupported_account'
              : 'missing_account',
        },
      );
      return;
    }

    homePositionPersistedAddress = cached.address;
    reconcileHomePositionSubscription();
    traceStartupDiagnostic(
      'perps',
      'persisted_position_subscription_registered',
      {
        durationMs: Date.now() - startedAt,
        accountType: cached.type,
      },
    );
  } catch (error) {
    traceStartupDiagnostic('perps', 'persisted_position_subscription_error', {
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });
    console.error('[perpsHomePosition] persisted subscription failed', error);
  }
};

runStartupTask(
  hydrateMarketDataCache,
  STARTUP_TASKS.perpsHydrateMarketDataCache,
);
runStartupTask(
  startMarketSnapshotSubscription,
  STARTUP_TASKS.perpsMarketSnapshotSubscription,
);
runStartupTask(fetchMarketDataIfNeeded, STARTUP_TASKS.perpsFetchMarketData);
runStartupTask(fetchFavoriteMarkets, STARTUP_TASKS.perpsFetchFavoriteMarkets);
runStartupTask(fetchMarginModeByCoin, STARTUP_TASKS.perpsFetchMarginModeByCoin);
runStartupTask(
  startPersistedPositionSubscription,
  STARTUP_TASKS.perpsPersistedPositionSubscription,
);

export function startSubscribePerpsOnAppState() {
  const subscription = AppState.addEventListener('change', nextAppState => {
    // Pass the state string ('active', 'background', 'inactive') directly
    apisPerps.getPerpsSDKSnapshot()?.ws.handleAppStateChange(nextAppState);

    // When app returns to active, retry market data if it previously failed or never loaded.
    if (nextAppState === 'active') {
      const { marketDataStatus, marketData } = perpsStore.getState();
      if (marketDataStatus === 'error' || marketData.length === 0) {
        fetchMarketData();
      }
    }
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
      addHomePositionAddresses(addresses);
    });

    return () => {
      eventBus.removeAllListeners('PERPS_ADD_ADDRESSES');
    };
  }, []);

  useEffect(() => {
    if (top10Accounts.length === 0) {
      return;
    }
    scheduleStartupTask(
      () => setHomePositionAccounts(top10Accounts),
      STARTUP_TASKS.perpsHomePositionSubscription,
    );
  }, [top10Accounts]);
};
