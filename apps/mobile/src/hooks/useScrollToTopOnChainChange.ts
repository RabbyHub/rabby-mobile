import { useEffect, useRef } from 'react';
import {
  useScroller,
  useTabNameContext,
  useTabsContext,
} from 'react-native-collapsible-tab-view/src/hooks';
import { runOnUI } from 'react-native-reanimated';

export const useScrollToTopOnChainChange = ({
  chain,
  isCurrentTab,
}: {
  chain: string | null | undefined;
  isCurrentTab: boolean;
}) => {
  const previousChainRef = useRef(chain);
  const pendingScrollRef = useRef(false);
  const tabName = useTabNameContext();
  const { refMap } = useTabsContext();
  const scrollTo = useScroller();

  useEffect(() => {
    const previousChain = previousChainRef.current;
    previousChainRef.current = chain;

    if (previousChain !== chain) {
      pendingScrollRef.current = true;
    }

    // The chain selector is a sheet: the tab can be unfocused while the user
    // picks a chain, so defer the scroll until the tab is current again.
    if (!pendingScrollRef.current || !isCurrentTab) {
      return;
    }
    pendingScrollRef.current = false;

    // The selected chain swaps the token projection asynchronously. The list
    // also keeps its visible item anchored across that data change
    // (`maintainVisibleContentPosition`), so scrolling in the same commit is
    // immediately overridden. Wait for the sheet close + projection commit,
    // then scroll the native list directly (QA 1131).
    const timer = setTimeout(() => {
      const target = refMap[tabName];
      const list = target?.current as
        | {
            scrollToLocation?: (params: {
              sectionIndex: number;
              itemIndex: number;
              viewOffset: number;
              animated: boolean;
            }) => void;
          }
        | null
        | undefined;

      if (list?.scrollToLocation) {
        list.scrollToLocation({
          sectionIndex: 0,
          itemIndex: 0,
          viewOffset: 0,
          animated: false,
        });
        return;
      }

      runOnUI(scrollTo)(target, 0, 0, false, '[useScrollToTopOnChainChange]');
    }, 250);

    return () => clearTimeout(timer);
  }, [chain, isCurrentTab, refMap, scrollTo, tabName]);
};
