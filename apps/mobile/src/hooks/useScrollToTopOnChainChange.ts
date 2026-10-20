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

    runOnUI(scrollTo)(
      refMap[tabName],
      0,
      0,
      false,
      '[useScrollToTopOnChainChange]',
    );
  }, [chain, isCurrentTab, refMap, scrollTo, tabName]);
};
