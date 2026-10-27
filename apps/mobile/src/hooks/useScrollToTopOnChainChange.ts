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
  const { refMap, contentInset } = useTabsContext();
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
    //
    // Land on the visual top (`-contentInset`), not the first row.
    // `scrollToLocation` clamps to y >= 0, which hides the iOS tab-bar inset
    // on the single-address page and the pull-to-refresh list header on the
    // multi-address page.
    const timer = setTimeout(() => {
      const target = refMap[tabName];
      const list = target?.current as
        | {
            getScrollResponder?: () => {
              scrollTo?: (params: {
                x?: number;
                y?: number;
                animated?: boolean;
              }) => void;
            } | null;
          }
        | null
        | undefined;
      const topOffset = -(contentInset?.value ?? 0);
      const responder = list?.getScrollResponder?.();

      if (responder?.scrollTo) {
        responder.scrollTo({ x: 0, y: topOffset, animated: false });
        return;
      }

      runOnUI(scrollTo)(target, 0, 0, false, '[useScrollToTopOnChainChange]');
    }, 250);

    return () => clearTimeout(timer);
  }, [chain, contentInset, isCurrentTab, refMap, scrollTo, tabName]);
};
