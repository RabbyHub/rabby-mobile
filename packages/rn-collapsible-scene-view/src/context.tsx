import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import {
  useAnimatedReaction,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

export type SceneTabKey = string;

export type SceneTabScrollHandle = {
  scrollTo: (offset: number, animated?: boolean) => void;
};

/**
 * Owns the shared offset and the per-tab scroll surfaces. It is created above
 * the provider so the owner of the pager can align a destination page before a
 * horizontal gesture starts, without threading callbacks through the tree.
 */
export type CollapsibleSceneController = {
  scrollY: SharedValue<number>;
  registerTabScroll: (
    tab: SceneTabKey,
    handle: SceneTabScrollHandle,
  ) => () => void;
  scrollToTab: (tab: SceneTabKey, offset: number, animated?: boolean) => void;
  syncTabToSceneOffset: (tab: SceneTabKey) => void;
};

export const useCollapsibleSceneController = (): CollapsibleSceneController => {
  const scrollY = useSharedValue(0);
  const handlesRef = useRef<
    Record<SceneTabKey, SceneTabScrollHandle | undefined>
  >({});

  const registerTabScroll = useCallback(
    (tab: SceneTabKey, handle: SceneTabScrollHandle) => {
      handlesRef.current[tab] = handle;
      return () => {
        if (handlesRef.current[tab] === handle) {
          delete handlesRef.current[tab];
        }
      };
    },
    [],
  );

  const scrollToTab = useCallback(
    (tab: SceneTabKey, offset: number, animated = false) => {
      handlesRef.current[tab]?.scrollTo(offset, animated);
    },
    [],
  );

  const syncTabToSceneOffset = useCallback(
    (tab: SceneTabKey) => {
      handlesRef.current[tab]?.scrollTo(scrollY.value, false);
    },
    [scrollY],
  );

  return useMemo(
    () => ({
      registerTabScroll,
      scrollToTab,
      scrollY,
      syncTabToSceneOffset,
    }),
    [registerTabScroll, scrollToTab, scrollY, syncTabToSceneOffset],
  );
};

export type CollapsibleSceneContextValue = {
  /** Header height that collapses away. */
  headerHeight: number;
  /** Offset of the active tab, published on the UI thread. */
  scrollY: SharedValue<number>;
  /** Current tab key, kept in a shared value for worklets. */
  activeTabIndex: SharedValue<number>;
  tabs: readonly SceneTabKey[];
  reportScroll: (tab: SceneTabKey, offset: number) => void;
  saveActiveOffset: () => void;
  getSavedOffset: (tab: SceneTabKey) => number;
  registerTabScroll: (
    tab: SceneTabKey,
    handle: SceneTabScrollHandle,
  ) => () => void;
  scrollToTab: (tab: SceneTabKey, offset: number, animated?: boolean) => void;
  syncOffsetOnActivate: boolean;
  syncTabToSceneOffset: (tab: SceneTabKey) => void;
};

const CollapsibleSceneContext =
  createContext<CollapsibleSceneContextValue | null>(null);

export const useCollapsibleScene = () => {
  const context = useContext(CollapsibleSceneContext);
  if (!context) {
    throw new Error(
      'useCollapsibleScene must be used inside CollapsibleSceneProvider',
    );
  }
  return context;
};

export const CollapsibleSceneProvider = ({
  activeTab,
  children,
  controller,
  headerHeight,
  scrollOffset,
  syncOffsetOnActivate = true,
  tabs,
}: {
  activeTab: SceneTabKey;
  children: React.ReactNode;
  controller?: CollapsibleSceneController;
  headerHeight: number;
  /** Optional externally owned offset (e.g. a pager's active-tab scroll). */
  scrollOffset?: SharedValue<number>;
  /**
   * When true (the default for a shared scene) a newly activated tab is
   * aligned to the current scene offset, so switching tabs never moves the
   * shared header/market/trade layers.
   */
  syncOffsetOnActivate?: boolean;
  tabs: readonly SceneTabKey[];
}) => {
  const ownScrollY = useSharedValue(0);
  const scrollY = scrollOffset ?? controller?.scrollY ?? ownScrollY;
  const activeTabIndex = useSharedValue(Math.max(tabs.indexOf(activeTab), 0));
  const activeTabRef = useRef(activeTab);
  const offsetsRef = useRef<Record<SceneTabKey, number>>({});
  const handlesRef = useRef<
    Record<SceneTabKey, SceneTabScrollHandle | undefined>
  >({});

  // Keep the shared index in sync with the controlled prop.
  const activeIndex = Math.max(tabs.indexOf(activeTab), 0);
  useAnimatedReaction(
    () => activeIndex,
    next => {
      activeTabIndex.value = next;
    },
    [activeIndex],
  );

  const reportScroll = useCallback(
    (tab: SceneTabKey, offset: number) => {
      offsetsRef.current[tab] = Math.max(0, offset);
      if (activeTabRef.current === tab) {
        scrollY.value = Math.max(0, offset);
      }
    },
    [scrollY],
  );

  const saveActiveOffset = useCallback(() => {
    offsetsRef.current[activeTabRef.current] = scrollY.value;
  }, [scrollY]);

  const getSavedOffset = useCallback(
    (tab: SceneTabKey) => offsetsRef.current[tab] ?? 0,
    [],
  );

  const registerTabScroll = useCallback(
    (tab: SceneTabKey, handle: SceneTabScrollHandle) => {
      handlesRef.current[tab] = handle;
      if (controller) {
        return controller.registerTabScroll(tab, handle);
      }
      return () => {
        if (handlesRef.current[tab] === handle) {
          delete handlesRef.current[tab];
        }
      };
    },
    [controller],
  );

  const scrollToTab = useCallback(
    (tab: SceneTabKey, offset: number, animated = false) => {
      if (controller) {
        controller.scrollToTab(tab, offset, animated);
        return;
      }
      handlesRef.current[tab]?.scrollTo(offset, animated);
    },
    [controller],
  );

  const syncTabToSceneOffset = useCallback(
    (tab: SceneTabKey) => {
      if (controller) {
        controller.syncTabToSceneOffset(tab);
        return;
      }
      handlesRef.current[tab]?.scrollTo(scrollY.value, false);
    },
    [controller, scrollY],
  );

  // A tab that becomes active must start at the scene offset. Without this, a
  // freshly mounted page (or one that was left at a different offset) would
  // show its rows at a different vertical position than the shared layers.
  const syncActivatedTab = useCallback(
    (tab: SceneTabKey) => {
      if (!syncOffsetOnActivate) {
        return;
      }
      syncTabToSceneOffset(tab);
    },
    [syncOffsetOnActivate, syncTabToSceneOffset],
  );

  useEffect(() => {
    syncActivatedTab(activeTab);
  }, [activeTab, syncActivatedTab]);

  activeTabRef.current = activeTab;

  const value = useMemo(
    () => ({
      activeTabIndex,
      getSavedOffset,
      headerHeight,
      registerTabScroll,
      reportScroll,
      saveActiveOffset,
      scrollY,
      scrollToTab,
      syncOffsetOnActivate,
      syncTabToSceneOffset,
      tabs,
    }),
    [
      activeTabIndex,
      getSavedOffset,
      headerHeight,
      registerTabScroll,
      reportScroll,
      saveActiveOffset,
      scrollY,
      scrollToTab,
      syncOffsetOnActivate,
      syncTabToSceneOffset,
      tabs,
    ],
  );

  return (
    <CollapsibleSceneContext.Provider value={value}>
      {children}
    </CollapsibleSceneContext.Provider>
  );
};
