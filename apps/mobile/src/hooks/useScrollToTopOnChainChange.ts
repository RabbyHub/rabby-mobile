import { useLayoutEffect, useRef, useState } from 'react';
import type { ScrollView } from 'react-native';
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
  const chainRef = useRef(chain);
  const pendingScrollRef = useRef(false);
  const [suspendVisibleAnchor, setSuspendVisibleAnchor] = useState(false);
  const tabName = useTabNameContext();
  const { refMap, contentInset } = useTabsContext();
  const scrollTo = useScroller();

  if (chain !== chainRef.current) {
    chainRef.current = chain;
    pendingScrollRef.current = true;
    if (!suspendVisibleAnchor) {
      setSuspendVisibleAnchor(true);
    }
  }

  useLayoutEffect(() => {
    if (!pendingScrollRef.current || !isCurrentTab) {
      return;
    }
    const target = refMap[tabName];
    const list = target?.current as
      | { getScrollResponder?: () => ScrollView | null | undefined }
      | null
      | undefined;
    const responder = list?.getScrollResponder?.();
    if (responder?.scrollTo) {
      // Use the applied inset, including zero, to preserve the resting gap.
      const inset =
        responder.props?.contentInset?.top ?? contentInset?.value ?? 0;
      responder.scrollTo({ x: 0, y: -inset, animated: false });
    } else {
      runOnUI(scrollTo)(target, 0, 0, false, '[useScrollToTopOnChainChange]');
    }

    if (!suspendVisibleAnchor) {
      pendingScrollRef.current = false;
      return;
    }

    // Restore anchoring after the projection settles, then correct its offset
    // in the next layout effect, after Fabric's native anchor adjustment.
    const timer = setTimeout(() => setSuspendVisibleAnchor(false), 250);
    return () => clearTimeout(timer);
  }, [
    chain,
    contentInset,
    isCurrentTab,
    refMap,
    scrollTo,
    suspendVisibleAnchor,
    tabName,
  ]);

  return suspendVisibleAnchor;
};
