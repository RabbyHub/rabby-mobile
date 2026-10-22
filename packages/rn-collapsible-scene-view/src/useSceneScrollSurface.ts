import { useCallback, useEffect } from 'react';
import type { AnimatedRef } from 'react-native-reanimated';
import {
  scrollTo as scrollToOnUI,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';

import { useCollapsibleScene, type SceneTabKey } from './context';

export type SceneScrollSurfaceHandle = {
  /** Scrolls this tab to an absolute vertical offset. */
  scrollTo: (offset: number, animated?: boolean) => void;
};

/**
 * Wiring shared by `SceneScrollView` and `SceneList`: publish this tab's offset
 * to the scene on the UI thread, register the surface so a pager can align it
 * before a page switch, and align the page when it becomes active.
 * @param options0
 * @param options0.nativeRef
 * @param options0.syncOnActivate
 * @param options0.tabKey
 */
export const useSceneScrollSurface = ({
  nativeRef,
  syncOnActivate,
  tabKey,
}: {
  nativeRef?: AnimatedRef<any>;
  syncOnActivate?: boolean;
  tabKey: SceneTabKey;
}) => {
  const {
    activeTabIndex,
    registerTabScroll,
    scrollY,
    syncOffsetOnActivate,
    tabs,
  } = useCollapsibleScene();
  const shouldSyncOnActivate = syncOnActivate ?? syncOffsetOnActivate;
  const ownRef = useAnimatedRef<any>();
  const resolvedRef = nativeRef ?? ownRef;
  const tabIndex = Math.max(tabs.indexOf(tabKey), 0);
  const lastReported = useSharedValue(-1);

  // Publish straight to the scene's shared value on the UI thread. This is the
  // whole point of the package: the layers read the same value in the same
  // frame, and JS is not involved while scrolling.
  const scrollHandler = useAnimatedScrollHandler(
    {
      onScroll: event => {
        const offset = Math.max(0, event.contentOffset.y);
        if (offset === lastReported.value) {
          return;
        }
        lastReported.value = offset;
        if (activeTabIndex.value === tabIndex) {
          scrollY.value = offset;
        }
      },
    },
    [tabIndex],
  );

  const scrollTo = useCallback(
    (offset: number, animated = false) => {
      const next = Math.max(0, Number.isFinite(offset) ? offset : 0);
      const target = (resolvedRef as { current?: any }).current;
      // Called from the JS thread by a pager/controller. Use the list's own
      // imperative API; `scrollTo` from Reanimated is UI-thread only.
      if (typeof target?.scrollToOffset === 'function') {
        target.scrollToOffset({ animated, offset: next });
        return;
      }
      if (typeof target?.getScrollResponder === 'function') {
        const responder = target.getScrollResponder();
        if (responder && typeof responder.scrollTo === 'function') {
          responder.scrollTo({ animated, x: 0, y: next });
          return;
        }
      }
      if (typeof target?.scrollTo === 'function') {
        target.scrollTo({ animated, x: 0, y: next });
      }
    },
    [resolvedRef],
  );

  // A newly activated page starts at the shared scene offset. The pager also
  // aligns the destination before a drag; this covers mount and native
  // re-attachment paths.
  useAnimatedReaction(
    () => activeTabIndex.value === tabIndex,
    (active, previous) => {
      if (active && !previous && shouldSyncOnActivate) {
        scrollToOnUI(resolvedRef as never, 0, scrollY.value, false);
        lastReported.value = scrollY.value;
      }
    },
    [shouldSyncOnActivate, tabIndex],
  );

  useEffect(
    () => registerTabScroll(tabKey, { scrollTo }),
    [registerTabScroll, scrollTo, tabKey],
  );

  return { resolvedRef, scrollHandler, scrollTo };
};
