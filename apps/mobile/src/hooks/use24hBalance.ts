import {
  getBalance24hCache,
  get24hBalance,
  IBalance24hData,
} from '@/utils/24hBalanceCache';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { formatSmallUsdValue } from './useCurve';
import PQueue from 'p-queue';
import { formatUsdValue } from '@/utils/number';
import { useCreationWithShallowCompare } from './common/useMemozied';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';

const queue = new PQueue({ intervalCap: 10, concurrency: 10, interval: 1000 });
const TEN_MINUTES = 10 * 60 * 1000;

type Multi24hBalanceState = {
  multi24hBalance: Record<
    string,
    { loading: boolean; data: IBalance24hData['data'] }
  >;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  setMulti24hBalance: (
    updater: UpdaterOrPartials<Multi24hBalanceState['multi24hBalance']>,
  ) => void;
};

export const useMulti24hBalanceStore = zCreate<Multi24hBalanceState>(set => ({
  multi24hBalance: {},
  loading: true,
  setLoading: loading =>
    set(state => (state.loading === loading ? state : { ...state, loading })),
  setMulti24hBalance: updater =>
    set(state => {
      const { newVal, changed } = resolveValFromUpdater(
        state.multi24hBalance,
        updater,
      );

      if (!changed) {
        return state;
      }

      return {
        ...state,
        multi24hBalance: newVal,
      };
    }),
}));

export const waitQueueFinished = (q: PQueue) => {
  return new Promise(resolve => {
    q.on('idle', () => {
      resolve(null);
    });
  });
};
export const useMulti24hBalance = (
  addresses: string[],
  options?: {
    isNavigationFocused?: boolean;
    disableAutoFetch?: boolean;
    totalBalance?: number;
    totalEvmBalance?: number;
  },
) => {
  const {
    isNavigationFocused = true,
    disableAutoFetch,
    totalBalance,
    totalEvmBalance,
  } = options || {};
  const multi24hBalance = useMulti24hBalanceStore(s => s.multi24hBalance);
  const setMulti24hBalance = useMulti24hBalanceStore(s => s.setMulti24hBalance);
  const loading = useMulti24hBalanceStore(s => s.loading);
  const setLoading = useMulti24hBalanceStore(s => s.setLoading);
  const loadingMapRef = useRef<Record<string, boolean>>({});
  const lastFetchTimeRef = useRef(0);

  const fetch = useCallback(
    async (address: string[], force = false) => {
      try {
        if (!address.length) {
          setLoading(false);
          return;
        }
        if (!force) {
          const now = Date.now();
          if (now - lastFetchTimeRef.current < TEN_MINUTES) {
            return;
          }
          lastFetchTimeRef.current = now;
        } else {
          lastFetchTimeRef.current = Date.now();
        }
        setLoading(!!force);
        const nextCheckAddress = new Set([...address]);
        !force &&
          address.forEach(_addr => {
            const addr = _addr.toLowerCase();
            setMulti24hBalance(prev => ({
              ...prev,
              [addr]: {
                ...(prev[addr] || {}),
                loading: true,
              },
            }));
            const cacheData = getBalance24hCache(addr);
            if (!cacheData?.data || cacheData?.isExpired) {
              return;
            }
            nextCheckAddress.delete(addr);
            setMulti24hBalance(prev => ({
              ...prev,
              [addr]: {
                loading: false,
                data: cacheData.data,
              },
            }));
          });
        queue.clear();
        Array.from(nextCheckAddress).forEach(_addr => {
          const addr = _addr.toLowerCase();
          queue.add(async () => {
            setMulti24hBalance(prev => ({
              ...prev,
              [addr]: {
                ...prev[addr],
                loading: true,
              },
            }));
            try {
              const address24hBalance = (await get24hBalance(addr, force))
                ?.data;
              setMulti24hBalance(prev => ({
                ...prev,
                [addr]: {
                  loading: false,
                  data: address24hBalance,
                },
              }));
            } catch (error) {
              console.error('Fetch curve error', error);
            } finally {
              loadingMapRef.current[addr] = false;
            }
          });
        });
        await waitQueueFinished(queue);
        setLoading(false);
      } catch (error) {
        console.error('Fetch curve error', error);
        setLoading(false);
      }
    },
    [setLoading, setMulti24hBalance],
  );

  const refresh = useCallback(
    async (force?: boolean) => {
      await fetch(addresses, force);
    },
    [addresses, fetch],
  );

  const stableAddresses = useCreationWithShallowCompare(
    () => addresses,
    [addresses],
  );
  const combineData = useMemo(() => {
    const list = !isNavigationFocused
      ? []
      : stableAddresses.map(address => {
          const data = multi24hBalance[address.toLowerCase()];
          return data?.data;
        });
    const isAllGet = list.length === stableAddresses.length;
    const total24hBalance = list.reduce((res, item) => {
      return res + (item?.total_usd_value || 0);
    }, 0);
    const assetsChange = (totalEvmBalance || 0) - total24hBalance;
    const rawNetWorth = isAllGet ? totalBalance || 0 : 0;

    return {
      list,
      rawNetWorth,
      netWorth: formatSmallUsdValue(totalBalance || 0),
      rawChange: assetsChange,
      change: `${formatUsdValue(Math.abs(assetsChange))}`,
      changePercent:
        total24hBalance !== 0
          ? `${Math.abs((assetsChange * 100) / total24hBalance).toFixed(2)}%`
          : `${totalEvmBalance === 0 ? '0' : '100.00'}%`,
      isLoss: assetsChange < 0,
      isEmptyAssets: total24hBalance === 0 && totalEvmBalance === 0,
    };
  }, [
    isNavigationFocused,
    stableAddresses,
    multi24hBalance,
    totalBalance,
    totalEvmBalance,
  ]);

  useEffect(() => {
    if (disableAutoFetch || queue.size > 0) {
      return;
    }
    if (combineData.list.length === 0) {
      fetch(addresses);
    }
  }, [addresses, combineData.list.length, disableAutoFetch, fetch]);

  const isLoadingNew = useMemo(() => {
    if (addresses.length === 0) {
      return false;
    }
    return addresses?.every(address => {
      return !multi24hBalance[address.toLowerCase()]?.data;
    });
  }, [addresses, multi24hBalance]);

  return {
    combineData,
    isLoadingNew,
    multi24hBalance,
    loading,
    fetch,
    refresh,
  };
};

export const getChangeData = (
  data: IBalance24hData['data'],
  realtimeNetWorth = 0,
  realtimeTimestamp?: number,
) => {
  const startData = data || { total_usd_value: 0 };
  const endNetWorth = realtimeTimestamp ? realtimeNetWorth : 0;
  const assetsChange = endNetWorth - startData?.total_usd_value;

  return {
    changePercent:
      startData?.total_usd_value !== 0
        ? `${Math.abs(
            (assetsChange * 100) / startData?.total_usd_value,
          ).toFixed(2)}%`
        : `${endNetWorth === 0 ? '0' : '100.00'}%`,
    isLoss: assetsChange < 0,
  };
};
