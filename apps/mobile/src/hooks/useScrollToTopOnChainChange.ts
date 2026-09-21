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
  const tabName = useTabNameContext();
  const { refMap } = useTabsContext();
  const scrollTo = useScroller();

  useEffect(() => {
    const previousChain = previousChainRef.current;
    previousChainRef.current = chain;

    if (previousChain === chain || !isCurrentTab) {
      return;
    }

    runOnUI(scrollTo)(
      refMap[tabName],
      0,
      0,
      false,
      '[useScrollToTopOnChainChange]',
    );
  }, [chain, isCurrentTab, refMap, scrollTo, tabName]);
};
