import React, { useEffect, useMemo, useRef } from 'react';
import type {
  SectionListData,
  SectionListProps,
  SectionListRenderItem,
} from 'react-native';
import { useShallow } from 'zustand/shallow';

import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';
import { beginUserVisibleJsWork } from '@/core/utils/userVisibleJsWork';
import {
  EMPTY_TOKEN_ASSETS_INDEX_RESULT,
  ensureTokenAssetsProjectionSegmentsHydrated,
  type TokenAssetsIndexRow,
  type TokenAssetsIndexSegments,
  useTokenAssetsIndexStore,
} from '@/store/tokens';
import type { RNGHScrollViewProps } from '@/components/customized/reexports';

export type TokenProjectionSegmentKey = keyof TokenAssetsIndexSegments;

export type TokenProjectionSectionSpec<TExtra> =
  | {
      key: string;
      segmentKey: TokenProjectionSegmentKey;
    }
  | {
      key: string;
      data: readonly TExtra[];
    };

export type TokenProjectionSectionItem<TExtra> = TokenAssetsIndexRow | TExtra;

export type TokenProjectionSection<TExtra> = SectionListData<
  TokenProjectionSectionItem<TExtra>
> & {
  key: string;
};

type Props<TExtra> = Omit<
  SectionListProps<
    TokenProjectionSectionItem<TExtra>,
    TokenProjectionSection<TExtra>
  >,
  'sections' | 'renderItem'
> &
  Partial<Pick<RNGHScrollViewProps, 'simultaneousHandlers' | 'waitFor'>> & {
    projectionKey: string | null;
    scene: 'single-address' | 'multi-address';
    sectionSpecs: readonly TokenProjectionSectionSpec<TExtra>[];
    renderItem: SectionListRenderItem<
      TokenProjectionSectionItem<TExtra>,
      TokenProjectionSection<TExtra>
    >;
    ListComponent: React.ComponentType<any>;
    storeLabel: string;
    userVisible?: boolean;
  };

export function TokenProjectionSectionList<TExtra>({
  projectionKey,
  scene,
  sectionSpecs,
  ListComponent,
  storeLabel,
  userVisible = false,
  ...listProps
}: Props<TExtra>) {
  const segmentKeys = useMemo(
    () =>
      sectionSpecs.flatMap(spec =>
        'segmentKey' in spec ? [spec.segmentKey] : [],
      ),
    [sectionSpecs],
  );
  const segmentRows = useActivityStore(
    useTokenAssetsIndexStore,
    useShallow(state => {
      const result = projectionKey
        ? scene === 'single-address'
          ? state.singleAssetsResultByKey[projectionKey]
          : state.multiAssetsResultByKey[projectionKey]
        : undefined;
      const segments = (result || EMPTY_TOKEN_ASSETS_INDEX_RESULT).segments;
      return segmentKeys.map(segmentKey => segments[segmentKey].rows);
    }),
    Object.is,
    { storeLabel },
  );
  useEffect(() => {
    if (!projectionKey || !segmentKeys.length) {
      return;
    }
    const releaseVisibleWork = userVisible
      ? beginUserVisibleJsWork(`${storeLabel}:segment-hydration`)
      : null;
    ensureTokenAssetsProjectionSegmentsHydrated({
      projectionKey,
      scene,
      segmentKeys,
    })
      .catch(error => {
        console.error(
          '[TokenProjectionSectionList] segment hydration failed',
          error,
        );
      })
      .finally(() => releaseVisibleWork?.());
  }, [projectionKey, scene, segmentKeys, segmentRows, storeLabel, userVisible]);
  const sectionCacheRef = useRef(
    new Map<string, TokenProjectionSection<TExtra>>(),
  );

  const sections = useMemo(() => {
    let segmentIndex = 0;
    const activeKeys = new Set<string>();
    const nextSections = sectionSpecs.flatMap(spec => {
      activeKeys.add(spec.key);
      const data = (
        'segmentKey' in spec ? segmentRows[segmentIndex++] : spec.data
      ) as TokenProjectionSectionItem<TExtra>[];
      if (!data.length) {
        return [];
      }
      const previous = sectionCacheRef.current.get(spec.key);
      if (previous?.data === data) {
        return [previous];
      }
      const next = { key: spec.key, data } as TokenProjectionSection<TExtra>;
      sectionCacheRef.current.set(spec.key, next);
      return [next];
    });

    sectionCacheRef.current.forEach((_, key) => {
      if (!activeKeys.has(key)) {
        sectionCacheRef.current.delete(key);
      }
    });
    return nextSections;
  }, [sectionSpecs, segmentRows]);

  return <ListComponent {...listProps} sections={sections} />;
}
