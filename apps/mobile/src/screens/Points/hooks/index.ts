import { openapi } from '@/core/request';
import { Account } from '@/core/services/preference';
import { useAccounts } from '@/hooks/account';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import { atom, useAtom, useAtomValue } from 'jotai';
import PQueue from 'p-queue';
import { useCallback, useEffect, useMemo, useState } from 'react';

type PointInfo = Awaited<ReturnType<typeof openapi.getRabbyPoints>>;
export type AccountPoints = Account & Partial<PointInfo>;

const pointsBadgeAtom = atom(0);

const AddrPointsQueue = new PQueue({
  interval: 1000,
  intervalCap: 10,
  concurrency: 10,
});

export const FILTER_ACCOUNT_TYPES = [KEYRING_CLASS.WATCH, KEYRING_CLASS.GNOSIS];

export const useGetRabbyPoints = () => {
  const [, setPointsBadgeAtom] = useAtom(pointsBadgeAtom);
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
    setPointsBadgeAtom(totalPoints);
  }, [points, setPointsBadgeAtom]);

  return accountsWithPoints;
};

export const usePointsBadge = () => {
  useGetRabbyPoints();
  return useAtomValue(pointsBadgeAtom);
};
