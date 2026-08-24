import type { PerpsProInfoTab } from '@/core/services/perpsService';
import { useCallback, useRef } from 'react';

import { PERPS_PRO_INFO_TABS } from './perpsProInfoTabOrder';

export type PerpsProInfoListHandle = {
  scrollToOffset: (params: { animated?: boolean; offset: number }) => void;
};

type PerpsProInfoPageOffsetState = {
  actualOffset: number;
  appliedOffset: number;
  commandedOffset: number | null;
  contentHeight: number;
  contentReady: boolean;
  desiredOffset: number;
  viewportHeight: number;
  viewportReady: boolean;
};

type PerpsProInfoPendingTransition = {
  animated: boolean;
  generation: number;
  issuedOffset: number | null;
  tab: PerpsProInfoTab;
};

const PERPS_PRO_INFO_OFFSET_EPSILON = 0.5;

const createPageOffsetState = (): PerpsProInfoPageOffsetState => ({
  actualOffset: 0,
  appliedOffset: 0,
  commandedOffset: null,
  contentHeight: 0,
  contentReady: false,
  desiredOffset: 0,
  viewportHeight: 0,
  viewportReady: false,
});

const createPageOffsetStates = (): Record<
  PerpsProInfoTab,
  PerpsProInfoPageOffsetState
> => ({
  account: createPageOffsetState(),
  positions: createPageOffsetState(),
  openOrders: createPageOffsetState(),
});

const areOffsetsEqual = (left: number, right: number) =>
  Math.abs(left - right) <= PERPS_PRO_INFO_OFFSET_EPSILON;

export const getPerpsProInfoPagePreparedOffset = ({
  activeOffset,
  storedOffset,
  stickyOffset,
}: {
  activeOffset: number;
  storedOffset: number;
  stickyOffset: number;
}) => {
  const safeActiveOffset = Number.isFinite(activeOffset)
    ? Math.max(0, activeOffset)
    : 0;
  const safeStoredOffset = Number.isFinite(storedOffset)
    ? Math.max(0, storedOffset)
    : 0;
  const safeStickyOffset = Number.isFinite(stickyOffset)
    ? Math.max(0, stickyOffset)
    : 0;

  return safeActiveOffset < safeStickyOffset
    ? safeActiveOffset
    : Math.max(safeStoredOffset, safeStickyOffset);
};

export const usePerpsProInfoPageOffsetLifecycle = ({
  getActiveScrollOffset,
  getSelectedTab,
  onActivateOffset,
  onPreparedTransition,
  stickyOffset,
}: {
  getActiveScrollOffset: () => number;
  getSelectedTab: () => PerpsProInfoTab;
  onActivateOffset: (offset: number) => void;
  onPreparedTransition: (tab: PerpsProInfoTab, animated: boolean) => boolean;
  stickyOffset: number;
}) => {
  const listRefs = useRef<
    Partial<Record<PerpsProInfoTab, PerpsProInfoListHandle | null>>
  >({});
  const pageOffsetsRef = useRef(createPageOffsetStates());
  const pendingTransitionRef = useRef<PerpsProInfoPendingTransition | null>(
    null,
  );
  const transitionGenerationRef = useRef(0);

  const getPageMaxOffset = useCallback((tab: PerpsProInfoTab) => {
    const page = pageOffsetsRef.current[tab];
    return Math.max(0, page.contentHeight - page.viewportHeight);
  }, []);

  const clampPageOffset = useCallback(
    (tab: PerpsProInfoTab, rawOffset: number) => {
      const safeOffset = Number.isFinite(rawOffset)
        ? Math.max(0, rawOffset)
        : 0;
      const page = pageOffsetsRef.current[tab];
      return page.contentReady && page.viewportReady
        ? Math.min(safeOffset, getPageMaxOffset(tab))
        : safeOffset;
    },
    [getPageMaxOffset],
  );

  const cancelPendingTransition = useCallback(() => {
    transitionGenerationRef.current += 1;
    pendingTransitionRef.current = null;
  }, []);

  const completePendingTransition = useCallback(
    (tab: PerpsProInfoTab, generation: number, appliedOffset: number) => {
      const pending = pendingTransitionRef.current;
      if (
        !pending ||
        pending.generation !== generation ||
        pending.tab !== tab
      ) {
        return;
      }

      if (!onPreparedTransition(tab, pending.animated)) {
        return;
      }

      const page = pageOffsetsRef.current[tab];
      page.actualOffset = appliedOffset;
      page.appliedOffset = appliedOffset;
      page.commandedOffset = null;
      pendingTransitionRef.current = null;
    },
    [onPreparedTransition],
  );

  const recordActualOffset = useCallback(
    (tab: PerpsProInfoTab, rawOffset: number) => {
      if (!Number.isFinite(rawOffset)) {
        return;
      }
      const page = pageOffsetsRef.current[tab];
      const actualOffset = clampPageOffset(tab, rawOffset);
      page.actualOffset = actualOffset;
      page.appliedOffset = actualOffset;
      if (
        page.commandedOffset != null &&
        areOffsetsEqual(actualOffset, page.commandedOffset)
      ) {
        page.commandedOffset = null;
      }

      const pending = pendingTransitionRef.current;
      if (
        pending?.tab === tab &&
        pending.issuedOffset != null &&
        areOffsetsEqual(actualOffset, pending.issuedOffset)
      ) {
        completePendingTransition(tab, pending.generation, actualOffset);
      }
    },
    [clampPageOffset, completePendingTransition],
  );

  const preparePageOffset = useCallback(
    (tab: PerpsProInfoTab) => {
      const page = pageOffsetsRef.current[tab];
      const list = listRefs.current[tab];
      if (!list || !page.contentReady || !page.viewportReady) {
        return;
      }

      const targetOffset = clampPageOffset(tab, page.desiredOffset);
      const pending = pendingTransitionRef.current;
      const isPendingTarget = pending?.tab === tab;

      if (areOffsetsEqual(page.actualOffset, targetOffset)) {
        page.actualOffset = targetOffset;
        page.appliedOffset = targetOffset;
        page.commandedOffset = null;
        if (isPendingTarget) {
          completePendingTransition(tab, pending.generation, targetOffset);
        }
        return;
      }

      if (
        isPendingTarget &&
        pending.issuedOffset != null &&
        areOffsetsEqual(pending.issuedOffset, targetOffset)
      ) {
        return;
      }
      if (
        !isPendingTarget &&
        page.commandedOffset != null &&
        areOffsetsEqual(page.commandedOffset, targetOffset)
      ) {
        return;
      }

      page.commandedOffset = targetOffset;
      if (isPendingTarget) {
        pending.issuedOffset = targetOffset;
      }
      list.scrollToOffset({ animated: false, offset: targetOffset });
    },
    [clampPageOffset, completePendingTransition],
  );

  const preparePages = useCallback(() => {
    const selectedTab = getSelectedTab();
    const rawActiveOffset = getActiveScrollOffset();
    const activeOffset = Number.isFinite(rawActiveOffset)
      ? Math.max(0, rawActiveOffset)
      : 0;
    const selectedPage = pageOffsetsRef.current[selectedTab];
    selectedPage.actualOffset = activeOffset;
    selectedPage.appliedOffset = activeOffset;
    selectedPage.desiredOffset = activeOffset;
    selectedPage.commandedOffset = null;

    for (const tab of PERPS_PRO_INFO_TABS) {
      if (tab === selectedTab) {
        continue;
      }
      const page = pageOffsetsRef.current[tab];
      page.desiredOffset = getPerpsProInfoPagePreparedOffset({
        activeOffset,
        stickyOffset,
        storedOffset: page.appliedOffset,
      });
      preparePageOffset(tab);
    }
  }, [getActiveScrollOffset, getSelectedTab, preparePageOffset, stickyOffset]);

  const requestPage = useCallback(
    (tab: PerpsProInfoTab, animated: boolean) => {
      const generation = transitionGenerationRef.current + 1;
      transitionGenerationRef.current = generation;
      pendingTransitionRef.current = {
        animated,
        generation,
        issuedOffset: null,
        tab,
      };
      preparePages();
      preparePageOffset(tab);
    },
    [preparePageOffset, preparePages],
  );

  const activatePage = useCallback(
    (tab: PerpsProInfoTab) => {
      cancelPendingTransition();
      const page = pageOffsetsRef.current[tab];
      const offset = clampPageOffset(tab, page.actualOffset);
      if (
        page.commandedOffset != null &&
        !areOffsetsEqual(page.commandedOffset, offset)
      ) {
        listRefs.current[tab]?.scrollToOffset({ animated: false, offset });
      }
      page.actualOffset = offset;
      page.appliedOffset = offset;
      page.desiredOffset = offset;
      page.commandedOffset = null;
      return offset;
    },
    [cancelPendingTransition, clampPageOffset],
  );

  const recordContentHeight = useCallback(
    (tab: PerpsProInfoTab, height: number) => {
      const page = pageOffsetsRef.current[tab];
      page.contentHeight = Number.isFinite(height) ? Math.max(0, height) : 0;
      page.contentReady = Number.isFinite(height);
      page.actualOffset = clampPageOffset(tab, page.actualOffset);
      page.appliedOffset = clampPageOffset(tab, page.appliedOffset);
      preparePageOffset(tab);
    },
    [clampPageOffset, preparePageOffset],
  );

  const recordViewportHeight = useCallback(
    (tab: PerpsProInfoTab, height: number) => {
      const page = pageOffsetsRef.current[tab];
      page.viewportHeight = Number.isFinite(height) ? Math.max(0, height) : 0;
      page.viewportReady = Number.isFinite(height) && height > 0;
      page.actualOffset = clampPageOffset(tab, page.actualOffset);
      page.appliedOffset = clampPageOffset(tab, page.appliedOffset);
      preparePageOffset(tab);
    },
    [clampPageOffset, preparePageOffset],
  );

  const setListRef = useCallback(
    (tab: PerpsProInfoTab, list: PerpsProInfoListHandle | null) => {
      listRefs.current[tab] = list;
      if (list) {
        preparePageOffset(tab);
      } else {
        pageOffsetsRef.current[tab].commandedOffset = null;
      }
    },
    [preparePageOffset],
  );

  const scrollActiveToOffset = useCallback(
    (tab: PerpsProInfoTab, rawOffset: number, animated: boolean) => {
      const offset = clampPageOffset(tab, rawOffset);
      const page = pageOffsetsRef.current[tab];
      page.desiredOffset = offset;
      page.commandedOffset = offset;
      listRefs.current[tab]?.scrollToOffset({ animated, offset });
      onActivateOffset(offset);
    },
    [clampPageOffset, onActivateOffset],
  );

  return {
    activatePage,
    cancelPendingTransition,
    getPageMaxOffset,
    preparePages,
    recordActualOffset,
    recordContentHeight,
    recordViewportHeight,
    requestPage,
    scrollActiveToOffset,
    setListRef,
  };
};
