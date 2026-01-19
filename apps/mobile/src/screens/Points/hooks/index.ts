import { openapi } from '@/core/request';
import { Account } from '@/core/services/preference';
import { zCreate } from '@/core/utils/reexports';
import { useAccounts } from '@/hooks/account';
import { KEYRING_CLASS } from '@rabby-wallet/keyring-utils';
import PQueue from 'p-queue';
import { useEffect, useMemo } from 'react';

type PointInfo = Awaited<ReturnType<typeof openapi.getRabbyPoints>> & {
  pointLoading?: boolean;
};
export type AccountPoints = Account & Partial<PointInfo>;

type PointsStore = {
  points: Record<string, PointInfo>;
  badge: number;
};

const AddrPointsQueue = new PQueue({
  interval: 60 * 1000,
  intervalCap: 100,
  concurrency: 10,
});

export const FILTER_ACCOUNT_TYPES = [KEYRING_CLASS.WATCH, KEYRING_CLASS.GNOSIS];

const pointsStore = zCreate<PointsStore>(() => ({
  points: {},
  badge: 0,
}));

function updatePoint(id: string, data: PointInfo) {
  pointsStore.setState(prev => {
    const prevPoint = prev.points[id];
    const prevClaimed = prevPoint?.claimed_points ?? 0;
    const nextClaimed = data?.claimed_points ?? 0;

    if (prevPoint === data && prevClaimed === nextClaimed) {
      return prev;
    }

    return {
      ...prev,
      points: {
        ...prev.points,
        [id]: { ...data, pointLoading: false },
      },
      badge: prev.badge - prevClaimed + nextClaimed,
    };
  });
}

const pointsFetchState = {
  inFlightPromise: null as Promise<void> | null,
  activeKey: '',
  pendingKey: '',
};

async function fetchPointsByKey(key: string) {
  const ids = key.split(';').filter(Boolean);

  if (!ids.length) {
    return;
  }

  ids.forEach(id => {
    AddrPointsQueue.add(async () => {
      try {
        const data = await openapi.getRabbyPointsV2({ id });
        updatePoint(id, data);
      } catch (error) {
        console.log('getPoints error', error);
      }
    });
  });

  await AddrPointsQueue.onIdle();
}

function schedulePointsFetch() {
  if (pointsFetchState.inFlightPromise) {
    return pointsFetchState.inFlightPromise;
  }

  pointsStore.setState(prev => {
    const prevPoints = { ...(prev?.points || {}) };
    Object.keys(prevPoints).forEach(key => {
      if (prevPoints[key]) {
        prevPoints[key] = { ...prevPoints[key], pointLoading: true };
      }
    });
    return { ...prev, points: {} };
  });

  const run = (async () => {
    while (pointsFetchState.pendingKey) {
      const key = pointsFetchState.pendingKey;
      pointsFetchState.pendingKey = '';
      pointsFetchState.activeKey = key;

      await fetchPointsByKey(key);

      pointsFetchState.activeKey = '';
    }
  })().finally(() => {
    pointsFetchState.inFlightPromise = null;
    if (pointsFetchState.pendingKey) {
      schedulePointsFetch();
    }
  });

  pointsFetchState.inFlightPromise = run;
  return run;
}

function requestPointsFetch(key: string) {
  if (!key) return;
  if (pointsFetchState.activeKey === key) {
    return pointsFetchState.inFlightPromise;
  }

  pointsFetchState.pendingKey = key;
  return schedulePointsFetch();
}

export const useGetRabbyPoints = () => {
  const { accounts, fetchAccounts } = useAccounts({
    disableAutoFetch: true,
  });
  const points = pointsStore(s => s.points);

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

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    requestPointsFetch(allAddrString);
  }, [allAddrString]);

  const accountsWithPoints: AccountPoints[] = useMemo(() => {
    return accounts
      .filter(e => !FILTER_ACCOUNT_TYPES.includes(e.type))
      .map(e => {
        const address = e.address.toLowerCase();
        const addrPointInfo = points[address];
        if (addrPointInfo) {
          return { ...e, ...addrPointInfo };
        }
        return e;
      })
      .sort(
        (pre: AccountPoints, now: AccountPoints) =>
          (now?.claimed_points || 0) - (pre?.claimed_points || 0),
      );
  }, [points, accounts]);

  return accountsWithPoints;
};

export const usePointsBadge = () => {
  useGetRabbyPoints();
  return pointsStore(s => s.badge);
};
