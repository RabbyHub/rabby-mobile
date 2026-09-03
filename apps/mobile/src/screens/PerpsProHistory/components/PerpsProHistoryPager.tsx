import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';
import PagerView, {
  type PagerViewOnPageSelectedEvent,
} from 'react-native-pager-view';

import type { PerpsProTradeAmountUnit } from '@/core/services/perpsService';
import { useHideTipsPopup } from '@/hooks/useTipsPopup';
import { PERPS_PRO_HISTORY_FEE_TIPS_OWNER } from '../constants';
import {
  PERPS_PRO_HISTORY_TABS,
  type PerpsProHistoryControllerState,
} from '../scene/perpsProHistoryControllerState';
import type { PerpsProHistoryTab } from '../types';
import { PerpsProHistoryList } from './PerpsProHistoryList';
import { PerpsProHistoryTabs } from './PerpsProHistoryTabs';

export const getPreparedPerpsProHistoryTabs = (
  activeTab: PerpsProHistoryTab,
  requestedTab: PerpsProHistoryTab | null,
) => {
  const activeIndex = PERPS_PRO_HISTORY_TABS.indexOf(activeTab);
  const requestedIndex = requestedTab
    ? PERPS_PRO_HISTORY_TABS.indexOf(requestedTab)
    : -1;
  if (requestedTab && Math.abs(requestedIndex - activeIndex) > 1) {
    return new Set<PerpsProHistoryTab>([activeTab, requestedTab]);
  }
  const result = new Set<PerpsProHistoryTab>();
  for (
    let index = Math.max(0, activeIndex - 1);
    index <= Math.min(PERPS_PRO_HISTORY_TABS.length - 1, activeIndex + 1);
    index += 1
  ) {
    const tab = PERPS_PRO_HISTORY_TABS[index];
    if (tab) {
      result.add(tab);
    }
  }
  return result;
};

export const PerpsProHistoryPager: React.FC<{
  active?: boolean;
  activeTab: PerpsProHistoryTab;
  amountUnit: PerpsProTradeAmountUnit;
  onChange: (tab: PerpsProHistoryTab) => void;
  onLoadEarlier: (tab: PerpsProHistoryTab) => void;
  onRefresh: (tab: PerpsProHistoryTab) => void;
  scrollHost?: 'bottomSheet' | 'screen';
  state: PerpsProHistoryControllerState;
}> = ({
  active = true,
  activeTab,
  amountUnit,
  onChange,
  onLoadEarlier,
  onRefresh,
  scrollHost = 'screen',
  state,
}) => {
  const pagerRef = useRef<PagerView>(null);
  const activeRef = useRef(active);
  const hideFeeTipsPopup = useHideTipsPopup(PERPS_PRO_HISTORY_FEE_TIPS_OWNER);
  const selectedIndexRef = useRef(PERPS_PRO_HISTORY_TABS.indexOf(activeTab));
  const scheduledPageFrameRef = useRef<number | null>(null);
  const [requestedTab, setRequestedTab] = useState<PerpsProHistoryTab | null>(
    null,
  );
  const preparedTabs = useMemo(
    () => getPreparedPerpsProHistoryTabs(activeTab, requestedTab),
    [activeTab, requestedTab],
  );
  const displayedTab = requestedTab ?? activeTab;

  useEffect(() => {
    activeRef.current = active;
    if (active) {
      return;
    }
    if (scheduledPageFrameRef.current !== null) {
      cancelAnimationFrame(scheduledPageFrameRef.current);
      scheduledPageFrameRef.current = null;
    }
    setRequestedTab(null);
  }, [active]);

  useEffect(
    () => () => {
      if (scheduledPageFrameRef.current !== null) {
        cancelAnimationFrame(scheduledPageFrameRef.current);
        scheduledPageFrameRef.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    const activeIndex = PERPS_PRO_HISTORY_TABS.indexOf(activeTab);
    if (!active || requestedTab || selectedIndexRef.current === activeIndex) {
      return;
    }
    selectedIndexRef.current = activeIndex;
    pagerRef.current?.setPageWithoutAnimation(activeIndex);
  }, [active, activeTab, requestedTab]);

  const selectTab = useCallback(
    (tab: PerpsProHistoryTab) => {
      if (!activeRef.current) {
        return;
      }
      const targetIndex = PERPS_PRO_HISTORY_TABS.indexOf(tab);
      if (targetIndex < 0) {
        return;
      }
      hideFeeTipsPopup();
      if (targetIndex === selectedIndexRef.current) {
        return;
      }
      const distance = Math.abs(targetIndex - selectedIndexRef.current);
      setRequestedTab(tab);
      if (scheduledPageFrameRef.current !== null) {
        cancelAnimationFrame(scheduledPageFrameRef.current);
      }
      let callbackCompleted = false;
      const frame = requestAnimationFrame(() => {
        callbackCompleted = true;
        scheduledPageFrameRef.current = null;
        if (!activeRef.current) {
          return;
        }
        if (distance === 1) {
          pagerRef.current?.setPage(targetIndex);
        } else {
          pagerRef.current?.setPageWithoutAnimation(targetIndex);
        }
      });
      scheduledPageFrameRef.current = callbackCompleted ? null : frame;
    },
    [hideFeeTipsPopup],
  );

  const handlePageSelected = useCallback(
    (event: PagerViewOnPageSelectedEvent) => {
      if (!activeRef.current) {
        return;
      }
      hideFeeTipsPopup();
      const position = event.nativeEvent.position;
      const tab = PERPS_PRO_HISTORY_TABS[position];
      if (!tab) {
        return;
      }
      selectedIndexRef.current = position;
      setRequestedTab(null);
      onChange(tab);
    },
    [hideFeeTipsPopup, onChange],
  );
  const handlePageScrollStateChanged = useCallback(
    (
      event: Parameters<
        NonNullable<
          React.ComponentProps<typeof PagerView>['onPageScrollStateChanged']
        >
      >[0],
    ) => {
      if (!activeRef.current) {
        return;
      }
      if (event.nativeEvent.pageScrollState === 'dragging') {
        hideFeeTipsPopup();
      }
    },
    [hideFeeTipsPopup],
  );

  return (
    <View
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
      pointerEvents={active ? 'auto' : 'none'}
      style={styles.container}>
      <PerpsProHistoryTabs activeTab={displayedTab} onChange={selectTab} />
      <PagerView
        initialPage={PERPS_PRO_HISTORY_TABS.indexOf(activeTab)}
        onPageScrollStateChanged={handlePageScrollStateChanged}
        onPageSelected={handlePageSelected}
        ref={pagerRef}
        scrollEnabled={active}
        style={styles.pager}
        testID="perps-pro-history-pager">
        {PERPS_PRO_HISTORY_TABS.map(tab => (
          <View
            collapsable={false}
            key={tab}
            pointerEvents={tab === activeTab && active ? 'auto' : 'none'}
            style={styles.page}
            testID={`perps-pro-history-page-${tab}`}>
            {preparedTabs.has(tab) ? (
              <PerpsProHistoryList
                active={tab === activeTab && active}
                amountUnit={amountUnit}
                onLoadEarlier={() => onLoadEarlier(tab)}
                onRefresh={() => onRefresh(tab)}
                onRetry={() => onRefresh(tab)}
                scrollHost={scrollHost}
                state={state[tab]}
                tab={tab}
              />
            ) : null}
          </View>
        ))}
      </PagerView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  pager: {
    flex: 1,
    marginTop: 12,
  },
});
