import { useCallback } from 'react';
import { useAtom, useSetAtom } from 'jotai';

import { appStorage, atomByMMKV } from '@/core/storage/mmkv';

export const CONVERT_DUST_BANNER_VISITED_KEY =
  '@home.convertDustBanner.visited';

export function getConvertDustBannerVisitedSnapshot() {
  return !!(appStorage.getItem(CONVERT_DUST_BANNER_VISITED_KEY) as
    | boolean
    | null);
}

const convertDustBannerVisitedAtom = atomByMMKV<boolean>(
  CONVERT_DUST_BANNER_VISITED_KEY,
  getConvertDustBannerVisitedSnapshot(),
  { getOnInit: true },
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

export function useConvertDustBannerDebugControls() {
  const [visited, setVisited] = useAtom(convertDustBannerVisitedAtom);

  const resetConvertDustBannerVisited = useCallback(() => {
    setVisited(false);
  }, [setVisited]);

  const markConvertDustBannerVisited = useCallback(() => {
    setVisited(true);
  }, [setVisited]);

  return {
    convertDustBannerVisited: resolveVisited(visited),
    resetConvertDustBannerVisited,
    markConvertDustBannerVisited,
  };
}
