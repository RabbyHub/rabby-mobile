import {
  getCurveCache,
  getNetCurve,
  ITIME_STEP_ITEM,
} from '@/utils/24balanceCurveCache';
import { patchCurveData } from '@/utils/curve';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CurveDayType, formChartData } from './useCurve';
import PQueue from 'p-queue';
import { atom, useAtom } from 'jotai';

const queue = new PQueue({ intervalCap: 10, concurrency: 10, interval: 1000 });

export const multiTimeStampAtom = atom<
  Record<string, { loading: boolean; data: ITIME_STEP_ITEM[] }>
>({});

export const waitQueueFinished = (q: PQueue) => {
  return new Promise(resolve => {
    q.on('idle', () => {
      resolve(null);
    });
  });
};

const combineMulitCurve = (timeStamps: ITIME_STEP_ITEM[][]) => {
  if (!timeStamps.length) {
    return [];
  }

  const startTime = timeStamps[0][0].timestamp;
  const interval = 30 * 60;
  const windows: ITIME_STEP_ITEM[] = Array(48)
    .fill(null)
    .map((_, index) => ({
      timestamp: startTime + index * interval,
      usd_value: 0,
    }));

  const result = windows.map((window, i) => {
    const windowStart = window.timestamp;
    const windowEnd = windowStart + interval;
    let sum = 0;
    let count = 0;

    timeStamps.forEach(addressData => {
      const pointsInWindow = addressData.filter(
        point => point.timestamp >= windowStart && point.timestamp < windowEnd,
      );

      if (pointsInWindow.length > 0) {
        const latestPoint = pointsInWindow.reduce((latest, current) =>
          current.timestamp > latest.timestamp ? current : latest,
        );
        sum += latestPoint.usd_value;
        count++;
      }
    });

    return {
      timestamp: windowEnd,
      usd_value: count > 0 ? sum : 0,
    };
  });

  const firstPoints = timeStamps.map(data => data[0]);
  const lastPoints = timeStamps.map(data => data[data.length - 1]);

  const firstSum = firstPoints.reduce((sum, point) => sum + point.usd_value, 0);
  const lastSum = lastPoints.reduce((sum, point) => sum + point.usd_value, 0);

  result[0] = {
    timestamp: startTime,
    usd_value: firstSum,
  };

  result[result.length - 1] = {
    timestamp: startTime + (48 - 1) * interval,
    usd_value: lastSum,
  };

  return result;
};

export const useMultiCurve = (
  addresses: string[],
  disableAutoFetch?: boolean,
  totalBalance?: number,
) => {
  const [multiTimeStamp, setMultiTimeStamp] = useAtom(multiTimeStampAtom);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(
    async (addres: string[], force = false) => {
      try {
        if (!addres.length) {
          return;
        }
        setLoading(!!force);
        const nextCheckAddress = new Set([...addres]);
        !force &&
          addres.forEach(_addr => {
            const addr = _addr.toLocaleLowerCase();
            setMultiTimeStamp(prev => ({
              ...prev,
              [addr]: {
                ...(prev[addr] || {}),
                loading: true,
              },
            }));
            const cacheData = getCurveCache(addr);
            if (!cacheData?.data || cacheData?.isExpired) {
              return;
            }
            const curve = cacheData.data;
            console.log(
              '🔍 CUSTOM_LOGGER:=>: curve',
              curve.length,
              addr.slice(-4),
            );
            const start = dayjs()
              .add(-24, 'hours')
              .add(10, 'minutes')
              .valueOf();
            const step = 5 * 60 * 1000;
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
            nextCheckAddress.delete(addr);
            setMultiTimeStamp(prev => ({
              ...prev,
              [addr]: {
                loading: false,
                data: result.map(item => {
                  return {
                    timestamp: dayjs(item.timestamp).unix(),
                    usd_value: item.price,
                  };
                }),
              },
            }));
          });
        queue.clear();
        Array.from(nextCheckAddress).forEach(_addr => {
          try {
            const addr = _addr.toLocaleLowerCase();
            queue.add(async () => {
              setMultiTimeStamp(prev => ({
                ...prev,
                [addr]: {
                  ...prev[addr],
                  loading: true,
                },
              }));
              const curve = await getNetCurve(addr, CurveDayType.DAY, force);
              const start = dayjs()
                .add(-24, 'hours')
                .add(10, 'minutes')
                .valueOf();
              const step = 5 * 60 * 1000;
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
              setMultiTimeStamp(prev => ({
                ...prev,
                [addr]: {
                  loading: false,
                  data: result.map(item => {
                    return {
                      timestamp: dayjs(item.timestamp).unix(),
                      usd_value: item.price,
                    };
                  }),
                },
              }));
            });
          } catch (error) {}
        });
        await waitQueueFinished(queue);
        setLoading(false);
      } catch (error) {
        console.error('Fetch curve error', error);
        setLoading(false);
      }
    },
    [setMultiTimeStamp],
  );

  const refresh = useCallback(
    async (force?: boolean) => {
      await fetch(addresses, force);
    },
    [addresses, fetch],
  );

  const combineData = useMemo(() => {
    const list = addresses
      .map(address => {
        const data = multiTimeStamp[address.toLocaleLowerCase()];
        return data?.data || [];
      })
      .filter(data => data.length > 0);
    return formChartData(
      combineMulitCurve(list),
      totalBalance || 0,
      new Date().getTime(),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addresses.length, multiTimeStamp, totalBalance]);

  useEffect(() => {
    if (disableAutoFetch || queue.size > 0) {
      return;
    }
    if (combineData.list.length === 0) {
      fetch(addresses);
    }
  }, [
    addresses,
    combineData.list.length,
    disableAutoFetch,
    fetch,
    multiTimeStamp,
  ]);

  const isLoadingNew = useMemo(() => {
    // return true;
    return addresses.some(address => {
      return !multiTimeStamp[address.toLocaleLowerCase()]?.data?.length;
    });
  }, [addresses, multiTimeStamp]);

  return {
    combineData,
    isLoadingNew,
    multiTimeStamp,
    loading,
    fetch,
    refresh,
  };
};
