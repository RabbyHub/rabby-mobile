import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from 'react';
import {
  useAnimatedReaction,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

export type SceneTabKey = string;

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
  headerHeight,
  tabs,
}: {
  activeTab: SceneTabKey;
  children: React.ReactNode;
  headerHeight: number;
  tabs: readonly SceneTabKey[];
}) => {
  const scrollY = useSharedValue(0);
  const activeTabIndex = useSharedValue(
    Math.max(tabs.indexOf(activeTab), 0),
  );
  const activeTabRef = useRef(activeTab);
  const offsetsRef = useRef<Record<SceneTabKey, number>>({});

  // Keep the shared index in sync with the controlled prop.
  const activeIndex = Math.max(tabs.indexOf(activeTab), 0);
  useAnimatedReaction(
    () => activeIndex,
    next => {
      activeTabIndex.value = next;
    },
    [activeIndex],
  );

  const reportScroll = useCallback((tab: SceneTabKey, offset: number) => {
    offsetsRef.current[tab] = Math.max(0, offset);
    if (activeTabRef.current === tab) {
      scrollY.value = Math.max(0, offset);
    }
  }, [scrollY]);

  const saveActiveOffset = useCallback(() => {
    offsetsRef.current[activeTabRef.current] = scrollY.value;
  }, [scrollY]);

  const getSavedOffset = useCallback(
    (tab: SceneTabKey) => offsetsRef.current[tab] ?? 0,
    [],
  );

  activeTabRef.current = activeTab;

  const value = useMemo(
    () => ({
      activeTabIndex,
      getSavedOffset,
      headerHeight,
      reportScroll,
      saveActiveOffset,
      scrollY,
      tabs,
    }),
    [
      activeTabIndex,
      getSavedOffset,
      headerHeight,
      reportScroll,
      saveActiveOffset,
      scrollY,
      tabs,
    ],
  );

  return (
    <CollapsibleSceneContext.Provider value={value}>
      {children}
    </CollapsibleSceneContext.Provider>
  );
};
