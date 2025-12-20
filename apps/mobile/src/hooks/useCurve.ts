import { getNetCurve } from '@/utils/24balanceCurveCache';
import { patchCurveData } from '@/utils/curve';
import { CurveDayType } from '@/utils/curveDayType';
import {
  coerceFloat,
  formatCurrency,
  formatUsdValue,
  splitNumberByStep,
} from '@/utils/number';
import dayjs from 'dayjs';
import { USD_CURRENCY } from '@/constant/currency';
import BigNumber from 'bignumber.js';
import { CurrencyItem } from '@rabby-wallet/rabby-api/dist/types';
import { zCreate, zMutative } from '@/core/utils/reexports';
import {
  resolveValFromUpdater,
  runIIFEFunc,
  UpdaterOrPartials,
} from '@/core/utils/store';
import { perfEvents } from '@/core/utils/perf';
import { useSingleHomeAddress } from '@/screens/Home/hooks/singleHome';
import { apisAddressBalance } from './useCurrentBalance';
import { useMemo } from 'react';
import { computeBalanceChange } from '@/core/apis/balance';

type CurveList = Array<{ timestamp: number; usd_value: number }>;

export type CurvePoint = {
  value: number;
  netWorth: string;
  change: string;
  rawChange: number;
  isLoss: boolean;
  changePercent: string;
  timestamp: number;
  dateString: string;
  clockTimeString: string;
  dateTimeString: string;
};

function lcAddr(address: string) {
  if (!address) return '';

  return address.toLowerCase();
}

export const formatSmallUsdValue = (value: number) => {
  if (!value) {
    return '$0';
  }
  if (value < 0.01) {
    return '<$0.01';
  }
  if (value <= 10) {
    return `$${splitNumberByStep(value.toFixed(2))}`;
  }
  return formatUsdValue(value, value > 1000000 ? 2 : 0, true);
};

export const formatSmallCurrencyValue = (
  value: number,
  options?: {
    currency?: CurrencyItem;
  },
) => {
  const { currency = USD_CURRENCY } = options || {};
  const val = new BigNumber(value).times(currency.usd_rate);
  if (val.isZero() || val.isNaN()) {
    return `${currency.symbol}0`;
  }

  if (val.isLessThan(0.01)) {
    return `<${currency.symbol}0.01`;
  }
  if (val.isLessThanOrEqualTo(10)) {
    return `${currency.symbol}${splitNumberByStep(val.toFixed(2))}`;
  }
  return formatCurrency(value, {
    decimal: val.isGreaterThan(1000000) ? 2 : 0,
    formatMillion: true,
    currency,
  });
};

const EXPECTED_CHECK_DIFF = 600;

export const formChartData = (
  data: CurveList,
  options: {
    realtimeNetWorth: number;
    realtimeTimestamp?: number;
    type?: CurveDayType;
    staticBalance?: number | null;
  },
) => {
  const {
    realtimeNetWorth = 0,
    realtimeTimestamp,
    type = CurveDayType.DAY,
    staticBalance = null,
  } = options;
  const startData = data[0] || { value: 0, timestamp: 0, usd_value: 0 };
  const startUsdValue = coerceFloat(startData.usd_value, 0);
  const step = type === CurveDayType.DAY ? 30 * 60 : 3 * 60 * 60;

  const list =
    data
      ?.reduce((acc: CurveList, curr) => {
        if (acc.length === 0) {
          return [curr];
        }
        const lastItem = acc[acc.length - 1];
        if (lastItem) {
          if (curr.timestamp - lastItem.timestamp >= step) {
            acc.push(curr);
          }
        } else {
          acc.push(curr);
        }
        return acc;
      }, [])
      .map(x => {
        const { assetsChange: change, changePercent } = computeBalanceChange(
          x.usd_value,
          startUsdValue,
        );

        return {
          value: x.usd_value || 0,
          netWorth: formatSmallUsdValue(x.usd_value),
          change: `${formatUsdValue(Math.abs(change))}`,
          rawChange: Math.abs(change),
          isLoss: change < 0,
          changePercent,
          timestamp: x.timestamp,
          dateString: dayjs.unix(x.timestamp).format('MM DD, HH:mm'),
          clockTimeString: dayjs.unix(x.timestamp).format('HH:mm'),
          dateTimeString: dayjs.unix(x.timestamp).format('MM DD, HH:mm'),
        };
      }) || [];

  // patch realtime newworth
  if (realtimeTimestamp) {
    const {
      assetsChange: realtimeChange,
      changePercent: realtimeChangePercent,
    } = computeBalanceChange(realtimeNetWorth, startUsdValue);

    list.push({
      value: realtimeNetWorth || 0,
      netWorth: formatSmallUsdValue(realtimeNetWorth),
      change: `${formatUsdValue(Math.abs(realtimeChange))}`,
      rawChange: Math.abs(realtimeChange),
      isLoss: realtimeChange < 0,
      changePercent: realtimeChangePercent,
      timestamp: Math.floor(realtimeTimestamp / 1000),
      dateString: dayjs.unix(realtimeTimestamp / 1000).format('MM DD, HH:mm'),
      clockTimeString: dayjs.unix(realtimeTimestamp / 1000).format('HH:mm'),
      dateTimeString: dayjs
        .unix(realtimeTimestamp / 1000)
        .format('MM DD, HH:mm'),
    });
  }

  const endNetWorth = list?.length ? list[list.length - 1]?.value || 0 : 0;
  const isEmptyAssets = endNetWorth === 0 && startUsdValue === 0;
  const { assetsChange, changePercent } = computeBalanceChange(
    endNetWorth,
    startUsdValue,
  );

  return {
    list,
    rawNetWorth: staticBalance || endNetWorth,
    netWorth: formatSmallUsdValue(staticBalance || endNetWorth),
    rawChange: assetsChange,
    change: `${formatUsdValue(Math.abs(assetsChange))}`,
    changePercent: changePercent,
    isLoss: assetsChange < 0,
    isEmptyAssets,
  };
};

type CurveState = {
  curveList: CurveList;
  loadedFromApi: boolean;
  updateTime: number;
  loadingCurve: boolean;
  selectData: ReturnType<typeof formChartData>;
  isDecrease: boolean;
};
function getDefaultCurveState(): CurveState {
  return {
    curveList: [],
    loadedFromApi: false,
    updateTime: 0,
    loadingCurve: false,
    selectData: formChartData([], {
      realtimeNetWorth: 0,
      type: CurveDayType.DAY,
      staticBalance: 0,
    }),
    isDecrease: false,
  };
}
type AddressCurveState = {
  [address: string]: CurveState | null;
};
export const loadingCurveState = zCreate(
  zMutative<AddressCurveState>(() => ({}), { strict: __DEV__ }),
);
export function makeDefaultSelectData(): ReturnType<typeof formChartData> {
  return {
    list: [],
    rawNetWorth: 0,
    rawChange: 0,
    netWorth: '',
    change: '',
    changePercent: '',
    isLoss: false,
    isEmptyAssets: false,
  };
}

export function useIsLoadingCurve(address?: string) {
  return {
    isLoadingCurve: loadingCurveState(s =>
      !address ? false : !!s[lcAddr(address)]?.loadingCurve,
    ),
  };
}

function setIsLoadingCurve(
  address: string,
  valOrFunc: UpdaterOrPartials<CurveState['loadingCurve']>,
) {
  address = lcAddr(address);
  loadingCurveState.setState(prev => {
    const { newVal, changed } = resolveValFromUpdater(
      prev[address]?.loadingCurve || false,
      valOrFunc,
      {
        strict: true,
      },
    );
    if (!changed) return prev;

    const addrState = (prev[address] = prev[address] || getDefaultCurveState());
    addrState.loadingCurve = newVal;
  });
}

function setCurveData(
  address: string,
  valOrFunc: UpdaterOrPartials<CurveState['curveList']>,
  input: {
    days?: CurveDayType;
    totalEvmBalance?: number;
    totalBalance: number | null;
    loadedFromApi: boolean;
  },
) {
  address = lcAddr(address);
  loadingCurveState.setState(prev => {
    const { newVal } = resolveValFromUpdater(
      prev[address]?.curveList || [],
      valOrFunc,
    );

    const selectData = formChartData(newVal, {
      realtimeNetWorth: input.totalEvmBalance ?? 0,
      realtimeTimestamp: new Date().getTime(),
      type: input.days ?? CurveDayType.DAY,
      staticBalance: input.totalBalance ?? 0,
    });

    const addrState = (prev[address] = prev[address] || getDefaultCurveState());
    addrState.loadedFromApi = input.loadedFromApi;
    addrState.updateTime = Date.now();
    addrState.curveList = newVal;
    addrState.selectData = selectData;
    addrState.isDecrease = selectData.isLoss;
  });
}

type FetchParams = {
  realtimeNetWorth: number | null;
  staticBalance: number | null;
};

const fetchCurveFor = async (
  addr: string,
  options?: Partial<FetchParams> & { force?: boolean; days: CurveDayType },
) => {
  const addressBalanceState = apisAddressBalance.getBalanceState(addr);
  const {
    realtimeNetWorth = addressBalanceState?.evmBalance,
    staticBalance = addressBalanceState?.balance,
    force = false,
    days = CurveDayType.DAY,
  } = options || {};
  /**
   * TODO: this is temporary solution, but this is still MUCH BETTER than its previous shape,
   * at least it's readable, observable, predictable and stable.
   */
  if (
    typeof realtimeNetWorth !== 'number' ||
    typeof staticBalance !== 'number'
  ) {
    console.warn(
      'realtimeNetWorth or staticBalance is invalid, skip this time fetch',
    );
    return;
  }
  try {
    setIsLoadingCurve(addr, true);
    const curve = await getNetCurve(addr, days, force);
    const start =
      days === CurveDayType.DAY
        ? dayjs().add(-24, 'hours').add(10, 'minutes').valueOf()
        : dayjs().add(-7, 'days').add(1, 'hours').valueOf();
    const step = days === CurveDayType.DAY ? 5 * 60 * 1000 : 60 * 60 * 1000;
    const result = patchCurveData(
      curve.map(item => {
        return {
          timestamp: item.timestamp * 1000,
          price: item.usd_value,
        };
      }),
      start,
      step,
    );
    setCurveData(
      addr,
      result.map(item => {
        return {
          timestamp: dayjs(item.timestamp).unix(),
          usd_value: item.price,
        };
      }),
      {
        days,
        totalEvmBalance: realtimeNetWorth,
        totalBalance: staticBalance,
        loadedFromApi: true,
      },
    );
  } catch (error) {
  } finally {
    setIsLoadingCurve(addr, false);
  }
};

export function useCurveDataByAddress(address: string) {
  const lcAddress = useMemo(() => lcAddr(address), [address]);

  // const defaultState = useMemo(() => getDefaultCurveState(), []);
  const curveState = loadingCurveState(s => s[lcAddress] || null);

  return {
    curveState,
  };
}

export function startSubscribeBalanceUpdated() {
  perfEvents.subscribe(
    'TMP_UPDATED:SINGLE_HOME_BALANCE',
    ({ address: addr, newBalance, force, fromScene }) => {
      console.debug(
        '[perf] TMP_UPDATED:SINGLE_HOME_BALANCE',
        addr,
        newBalance,
        force,
        fromScene,
      );

      switch (fromScene) {
        case 'SingleAddressHome': {
          fetchCurveFor(addr, {
            days: CurveDayType.DAY,
            realtimeNetWorth: newBalance?.evmBalance,
            staticBalance: newBalance?.balance,
            force: force,
          });
          break;
        }
        default: {
          break;
        }
      }
    },
  );
}
