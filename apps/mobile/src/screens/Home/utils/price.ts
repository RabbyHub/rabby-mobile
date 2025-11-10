import { openapi, testOpenapi } from '@/core/request';
import { chunk } from 'lodash';
import { pQueue } from './project';
import BigNumber from 'bignumber.js';

// 历史 token 价格
export const getTokenHistoryPrice = async (
  chain: string,
  ids: string[],
  time_at: number,
  isTestnet = false,
) => {
  const idChunks = chunk(ids, 100);

  const res = await Promise.all(
    idChunks.map(c =>
      pQueue.add(() => {
        if (isTestnet) {
          return testOpenapi
            .getTokenHistoryDict({
              chainId: chain,
              ids: c.join(','),
              timeAt: time_at,
            })
            .catch(() => null);
        }
        return openapi
          .getTokenHistoryDict({
            chainId: chain,
            ids: c.join(','),
            timeAt: time_at,
          })
          .catch(() => null);
      }),
    ),
  );

  return res.reduce(
    (m, n) => (n ? { ...m, ...n } : m),
    {} as Record<string, number>,
  );
};

export const formatUsdValueKMB = (
  value: string | number,
  decimals = 2,
): string => {
  const bnValue = new BigNumber(value);

  if (bnValue.lt(0)) {
    return '-';
  }

  const numValue = bnValue.toNumber();
  let formattedValue: string;

  if (numValue >= 1e9) {
    formattedValue = `${(numValue / 1e9).toFixed(decimals)}B`;
  } else if (numValue >= 1e6) {
    formattedValue = `${(numValue / 1e6).toFixed(decimals)}M`;
  } else if (numValue >= 1e3) {
    formattedValue = `${(numValue / 1e3).toFixed(decimals)}K`;
  } else {
    formattedValue = numValue.toFixed(2);
  }

  return `$${formattedValue}`;
};

export const formatUsdValueKMBWithSign = (value: string | number): string => {
  const bnValue = new BigNumber(value);

  if (bnValue.lt(0)) {
    return `-${formatUsdValueKMB(Math.abs(bnValue.toNumber()))}`;
  }

  return `+${formatUsdValueKMB(bnValue.toNumber())}`;
};

export const formatPercent = (value: number, decimals = 8) => {
  return `${(value * 100).toFixed(decimals)}%`;
};
