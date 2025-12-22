import { openapi } from '@/core/request';
import { Account } from '@/core/services/preference';
import { useAccounts } from '@/hooks/account';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import PQueue from 'p-queue';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { zCreate } from '@/core/utils/reexports';
import { UpdaterOrPartials, resolveValFromUpdater } from '@/core/utils/store';

type PointInfo = Awaited<ReturnType<typeof openapi.getRabbyPoints>>;
export type AccountPoints = Account & Partial<PointInfo>;

const pointsBadgeStore = zCreate<number>(() => 0);

function setPointsBadgeState(valOrFunc: UpdaterOrPartials<number>) {
  pointsBadgeStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev, valOrFunc, {
      strict: false,
    });
    return newVal;
  });
}

export const usePointsBadgeValue = () => {
  const pointsBadge = pointsBadgeStore();
  return pointsBadge;
};

const AddrPointsQueue = new PQueue({
  interval: 1000,
  intervalCap: 10,
  concurrency: 10,
});

export const FILTER_ACCOUNT_TYPES = [KEYRING_CLASS.WATCH, KEYRING_CLASS.GNOSIS];

export const useGetRabbyPoints = () => {
  const { accounts, fetchAccounts } = useAccounts({
    disableAutoFetch: true,
  });

  const [points, setPoints] = useState<Record<string, PointInfo>>({});

  const allAddrString = useMemo(
    () =>
      Array.from(
        new Set(
          accounts
            .filter(e => !FILTER_ACCOUNT_TYPES.includes(e.type))
            .map(e => e.address?.toLowerCase()),
        ),
      ).join(';'),
    [accounts],
  );

  const getPoints = useCallback(() => {
    const arr = allAddrString.split(';').filter(e => !!e);
    if (!arr.length) {
      return;
    }
    arr.forEach(id => {
      AddrPointsQueue.add(async () => {
        try {
          const data = await openapi.getRabbyPointsV2({ id });
          setPoints(pre => ({ ...pre, [id]: data }));
        } catch (error) {
          console.log('getPoints error', error);
        }
      });
    });
  }, [allAddrString]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    getPoints();
  }, [getPoints]);

  const accountsWithPoints: AccountPoints[] = useMemo(() => {
    return accounts
      .filter(e => !FILTER_ACCOUNT_TYPES.includes(e.type))
      .map(e => {
        const addrPointInfo = points[e.address.toLowerCase()];
        if (points[e.address.toLowerCase()]) {
          return { ...e, ...addrPointInfo };
        }
        return e;
      })
      .sort(
        (pre: AccountPoints, now: AccountPoints) =>
          (now?.claimed_points || 0) - (pre?.claimed_points || 0),
      );
  }, [points, accounts]);

  useEffect(() => {
    const totalPoints = Object.values(points).reduce((acc, curr) => {
      return acc + (curr.claimed_points || 0);
    }, 0);
    setPointsBadgeState(totalPoints);
  }, [points]);

  return accountsWithPoints;
};

export const usePointsBadge = () => {
  useGetRabbyPoints();
  return usePointsBadgeValue();
};
