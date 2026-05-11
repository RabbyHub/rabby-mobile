import { useCallback } from 'react';
import { useAtom, useSetAtom } from 'jotai';

import { atomByMMKV } from '@/core/storage/mmkv';

const convertDustBannerVisitedAtom = atomByMMKV<boolean>(
  '@home.convertDustBanner.visited',
  false,
);

function resolveVisited(value: boolean | undefined) {
  return !!value;
}

export function useConvertDustBanner() {
  const [visited, setVisited] = useAtom(convertDustBannerVisitedAtom);

  const dismissConvertDustBanner = useCallback(() => {
    setVisited(prev => {
      if (resolveVisited(prev)) {
        return prev;
      }
      return true;
    });
  }, [setVisited]);

  return {
    shouldShowConvertDustBanner: !resolveVisited(visited),
    dismissConvertDustBanner,
  };
}

export function useDismissConvertDustBanner() {
  const setVisited = useSetAtom(convertDustBannerVisitedAtom);

  return useCallback(() => {
    setVisited(prev => {
      if (resolveVisited(prev)) {
        return prev;
      }
      return true;
    });
  }, [setVisited]);
}
