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
  // 30分钟的秒数
  const interval = 30 * 60;
  // 创建48个时间窗口
  const windows: ITIME_STEP_ITEM[] = Array(48)
    .fill(null)
    .map((_, index) => ({
      timestamp: startTime + index * interval,
      usd_value: 0,
    }));

  // 遍历每个窗口
  return windows.map((window, i) => {
    const windowStart = window.timestamp;
    const windowEnd = windowStart + interval;
    let sum = 0;
    let count = 0;

    // 在每个窗口中查找所有地址的数据点
    timeStamps.forEach(addressData => {
      // 找到该时间窗口内的所有数据点
      const pointsInWindow = addressData.filter(
        point => point.timestamp >= windowStart && point.timestamp < windowEnd,
      );

      // 如果窗口内有数据点，取最新的一个
      if (pointsInWindow.length > 0) {
        const latestPoint = pointsInWindow.reduce((latest, current) =>
          current.timestamp > latest.timestamp ? current : latest,
        );
        sum += latestPoint.usd_value;
        count++;
      }
    });

    // 返回该时间窗口的数据点
    return {
      timestamp: windowEnd,
      usd_value: count > 0 ? sum : 0,
    };
  });
};

export const useMultiCurve = (
  addresses: string[],
  disableAutoFetch?: boolean,
) => {
  const [multiTimeStamp, setMultiTimeStamp] = useAtom(multiTimeStampAtom);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(
    async (addres: string[], force = false) => {
      if (!addres.length) {
        return;
      }
      setLoading(true);
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
          if (!cacheData?.data) {
            return;
          }
          const curve = cacheData.data;
          console.log(
            '🔍 CUSTOM_LOGGER:=>: curve',
            curve.length,
            addr.slice(-4),
          );
          const start = dayjs().add(-24, 'hours').add(10, 'minutes').valueOf();
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

          if (!cacheData.isExpired) {
            nextCheckAddress.delete(addr);
          }
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
    },
    [setMultiTimeStamp],
  );

  const refresh = async (force?: boolean) => {
    await fetch(addresses, force);
  };

  const combineData = useMemo(() => {
    const list = addresses
      .map(address => {
        const data = multiTimeStamp[address.toLocaleLowerCase()];
        return data?.data || [];
      })
      .filter(data => data.length > 0);
    return formChartData(combineMulitCurve(list));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addresses.length, multiTimeStamp]);

  useEffect(() => {
    if (disableAutoFetch || queue.size > 0) {
      return;
    }
    if (combineData.list.length === 0) {
      fetch(addresses);
    }
    if (Object.keys(multiTimeStamp).length === addresses.length) {
      setLoading(false);
    }
  }, [
    addresses,
    combineData.list.length,
    disableAutoFetch,
    fetch,
    multiTimeStamp,
  ]);

  return {
    combineData,
    multiTimeStamp,
    loading,
    refresh,
  };
};
