import { useCallback, useMemo } from 'react';
import { useAtom } from 'jotai';

import { atomByMMKV } from '@/core/storage/mmkv';
import {
  HOME_FEATURE_NEW_TAG_CONFIG,
  MultiHomeFeatTitle,
} from '@/constant/newStyle';

type HomeFeatureVisitedMap = Record<string, boolean>;

const homeFeatureNewTagAtom = atomByMMKV<HomeFeatureVisitedMap>(
  '@home.newFeature.visited',
  {},
);

export function useHomeFeatureNewTag(featureKey: MultiHomeFeatTitle) {
  const [visitedMap, setVisitedMap] = useAtom(homeFeatureNewTagAtom);

  const config = useMemo(
    () => HOME_FEATURE_NEW_TAG_CONFIG[featureKey],
    [featureKey],
  );

  const visited = useMemo(
    () => !!visitedMap?.[featureKey],
    [featureKey, visitedMap],
  );

  const shouldShowNewTag = useMemo(() => {
    if (!config?.enableNewTag) {
      return false;
    }
    return !visited;
  }, [config?.enableNewTag, visited]);

  const markVisited = useCallback(() => {
    if (!config?.enableNewTag) {
      return;
    }

    setVisitedMap(prev => {
      const next = { ...(prev || {}) };
      if (next[featureKey]) {
        return prev;
      }
      next[featureKey] = true;
      return next;
    });
  }, [config?.enableNewTag, featureKey, setVisitedMap]);

  return {
    shouldShowNewTag,
    markVisited,
  };
}
